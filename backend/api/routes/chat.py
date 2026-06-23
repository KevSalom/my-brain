"""
Endpoints de chat/consulta RAG de My Brain LM con persistencia e historial.

Permite listar, crear conversaciones por área y realizar consultas con streaming RAG,
guardando el historial completo en SQLite.
"""

import asyncio
import json
from typing import AsyncGenerator, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from api.database import get_session, engine
from api.models import Conversation, Message, Area
from api.schemas import ChatRequest, ConversationResponse, MessageResponse, ConversationUpdate
from query import query_stream

router = APIRouter(prefix="/api/chat", tags=["Chat"])


class ConversationCreate(BaseModel):
    """Cuerpo de solicitud para crear una nueva conversación."""
    title: Optional[str] = Field(default=None, description="Título de la conversación. Si es None se creará uno por defecto.")


# =====================================================================
# Gestión de Conversaciones por Área
# =====================================================================

@router.get("/areas/{area_id}/conversations", response_model=List[ConversationResponse])
def list_area_conversations(area_id: str, session: Session = Depends(get_session)):
    """Obtiene todas las conversaciones asociadas a un Área."""
    # Verificar que el área existe
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    return area.conversations


@router.post("/areas/{area_id}/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    area_id: str,
    payload: ConversationCreate,
    session: Session = Depends(get_session)
):
    """Crea un nuevo hilo de conversación dentro de un Área."""
    # Verificar que el área existe
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    # Título por defecto
    title = payload.title or "Nueva conversación"

    db_conv = Conversation(
        title=title,
        area_id=area_id
    )
    session.add(db_conv)
    session.commit()
    session.refresh(db_conv)
    return db_conv


@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    session: Session = Depends(get_session)
):
    """Actualiza el título de una conversación."""
    conv = session.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada.")

    conv.title = payload.title
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: str, session: Session = Depends(get_session)):
    """Elimina una conversación y todo su historial de mensajes (en cascada)."""
    conv = session.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada.")

    session.delete(conv)
    session.commit()
    return


# =====================================================================
# Historial de Mensajes y Streaming
# =====================================================================

@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def list_conversation_messages(conversation_id: str, session: Session = Depends(get_session)):
    """Recupera el historial cronológico de mensajes de una conversación."""
    conv = session.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada.")

    # Ordenar por id (orden de creación)
    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.id)
    return session.exec(stmt).all()


@router.post("/conversations/{conversation_id}/stream")
async def chat_stream(
    conversation_id: str,
    request: ChatRequest,
    session: Session = Depends(get_session)
):
    """Ejecuta una consulta RAG en el Área de la conversación con streaming (SSE) y persiste el historial.

    Protocolo SSE:
    - Cada token: `data: {"token": "texto"}\n\n`
    - Al finalizar: `data: {"done": true, "sources": [...], "context_chunks": [...]}\n\n`
    - En caso de error: `data: {"error": "mensaje"}\n\n`
    """
    # 1. Validar que la conversación existe
    conv = session.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada.")

    # 2. Guardar mensaje del usuario
    user_msg = Message(
        role="user",
        content=request.question,
        conversation_id=conversation_id
    )
    session.add(user_msg)
    session.commit()
    session.refresh(user_msg)

    # Colección ChromaDB asociada al Área de la conversación
    collection_name = f"mybrain_area_{conv.area_id}"

    # Cargar historial conversacional para memoria multi-turno
    # Se excluye el mensaje actual del usuario (recién guardado) porque ya va como contexto RAG.
    from config import settings as app_settings
    stmt_history = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .where(Message.id != user_msg.id)
        .order_by(Message.id)
    )
    all_previous = session.exec(stmt_history).all()
    # Tomar solo los últimos N mensajes configurados
    recent_messages = all_previous[-(app_settings.memory_max_messages):]
    chat_history = [
        {"role": msg.role, "content": msg.content}
        for msg in recent_messages
    ]

    # Generador de eventos SSE
    async def event_generator() -> AsyncGenerator[str, None]:
        # Usamos una sesión fresca para el hilo de fondo de streaming
        with Session(engine) as db_session:
            try:
                # Emitir status inicial
                yield f'data: {json.dumps({"status": "Thinking..."}, ensure_ascii=False)}\n\n'

                final_answer = ""
                sources = []
                context_chunks = []

                # 1. Generar título dinámico si es el primer mensaje y tiene el título predeterminado
                conv_db = db_session.get(Conversation, conversation_id)
                stmt = select(Message).where(Message.conversation_id == conversation_id)
                messages = db_session.exec(stmt).all()
                if len(messages) == 1 and conv_db.title == "Nueva conversación":
                    from query import generate_title_from_question
                    first_question = messages[0].content
                    try:
                        new_title = generate_title_from_question(first_question)
                        conv_db.title = new_title
                        db_session.add(conv_db)
                        db_session.commit()
                        db_session.refresh(conv_db)
                    except Exception as title_err:
                        print(f"Error generando título dinámico: {title_err}")

                # query_stream es un generador SÍNCRONO bloqueante.
                # Si lo llamamos directamente con `for ... in query_stream(...)` dentro de
                # un `async def`, bloqueamos el event loop de asyncio y ningún `yield`
                # puede salir al cliente hasta que el generador termina por completo.
                #
                # Solución: corremos query_stream en un ThreadPoolExecutor (hilo separado)
                # y comunicamos cada tupla al event loop vía asyncio.Queue, lo que permite
                # que el event loop fluya libremente y envíe cada chunk SSE de inmediato.
                _sentinel = object()  # marcador especial para indicar fin del generador
                loop = asyncio.get_event_loop()
                queue: asyncio.Queue = asyncio.Queue()

                def _run_query_in_thread():
                    """Corre query_stream en un hilo y mete cada item en la queue."""
                    try:
                        for item in query_stream(
                            question=request.question,
                            top_k=request.top_k,
                            strategy_name=request.strategy,
                            collection_name=collection_name,
                            chat_history=chat_history if chat_history else None
                        ):
                            loop.call_soon_threadsafe(queue.put_nowait, item)
                    except Exception as exc:
                        loop.call_soon_threadsafe(queue.put_nowait, exc)
                    finally:
                        loop.call_soon_threadsafe(queue.put_nowait, _sentinel)

                # Lanzar el generador síncrono en un hilo de fondo
                asyncio.get_event_loop().run_in_executor(None, _run_query_in_thread)

                # Consumir la queue de forma async — el event loop puede ceder entre items
                while True:
                    item = await queue.get()
                    if item is _sentinel:
                        break
                    if isinstance(item, Exception):
                        raise item
                    token, final_result, item_status = item

                    if item_status:
                        event_data = json.dumps({"status": item_status}, ensure_ascii=False)
                        yield f"data: {event_data}\n\n"

                    if token:
                        final_answer += token
                        event_data = json.dumps({"token": token}, ensure_ascii=False)
                        yield f"data: {event_data}\n\n"

                    if final_result is not None:
                        sources = final_result.sources
                        context_chunks = final_result.context_chunks

                        db_session.refresh(conv_db)
                        done_data = json.dumps(
                            {
                                "done": True,
                                "sources": sources,
                                "context_chunks": context_chunks,
                                "title": conv_db.title,
                            },
                            ensure_ascii=False,
                        )
                        yield f"data: {done_data}\n\n"

                # Guardar mensaje del asistente una vez terminado el stream con éxito
                sources_str = json.dumps(sources, ensure_ascii=False) if sources else None
                assistant_msg = Message(
                    role="assistant",
                    content=final_answer,
                    sources_json=sources_str,
                    conversation_id=conversation_id
                )
                db_session.add(assistant_msg)
                db_session.commit()

            except ValueError as e:
                error_data = json.dumps({"error": str(e)}, ensure_ascii=False)
                yield f"data: {error_data}\n\n"
            except Exception as e:
                error_data = json.dumps(
                    {"error": f"Error al procesar la consulta: {str(e)}"},
                    ensure_ascii=False,
                )
                yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
            "Transfer-Encoding": "chunked",
        },
    )
