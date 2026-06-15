"""
Endpoints de chat/consulta RAG de My Brain LM.

POST /api/chat         — Consulta completa (respuesta JSON de una vez).
POST /api/chat/stream  — Consulta con streaming via Server-Sent Events (SSE).
"""

import json
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from query import query, query_stream
from api.schemas import ChatRequest, ChatResponse, SourceInfo

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post(
    "",
    response_model=ChatResponse,
    summary="Chat con My Brain LM",
    description="Envía una pregunta y recibe la respuesta completa del RAG.",
)
async def chat_query(request: ChatRequest):
    """Ejecuta una consulta RAG y retorna la respuesta completa."""
    
    try:
        result = query(
            question=request.question,
            top_k=request.top_k,
            strategy_name=request.strategy,
        )
        
        return ChatResponse(
            answer=result.answer,
            sources=[
                SourceInfo(**src) for src in result.sources
            ],
            context_chunks=result.context_chunks,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar la consulta: {str(e)}")


@router.post(
    "/stream",
    summary="Chat con streaming (SSE)",
    description=(
        "Envía una pregunta y recibe la respuesta token por token "
        "via Server-Sent Events (SSE). "
        "Cada evento `data:` contiene un JSON con `token` o `done`."
    ),
)
async def chat_stream(request: ChatRequest):
    """Ejecuta una consulta RAG con streaming de la respuesta via SSE.
    
    Protocolo SSE:
    - Cada token: `data: {"token": "texto"}\n\n`
    - Al finalizar: `data: {"done": true, "sources": [...], "context_chunks": [...]}\n\n`
    - En caso de error: `data: {"error": "mensaje"}\n\n`
    """
    
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            for token, final_result in query_stream(
                question=request.question,
                top_k=request.top_k,
            ):
                if token:
                    # Enviar cada token como evento SSE
                    event_data = json.dumps({"token": token}, ensure_ascii=False)
                    yield f"data: {event_data}\n\n"
                
                if final_result is not None:
                    # Enviar el resultado final con fuentes
                    done_data = json.dumps(
                        {
                            "done": True,
                            "sources": final_result.sources,
                            "context_chunks": final_result.context_chunks,
                        },
                        ensure_ascii=False,
                    )
                    yield f"data: {done_data}\n\n"
        
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
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Desactivar buffering en nginx/proxies
        },
    )
