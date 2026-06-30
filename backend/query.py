"""
Módulo de consulta y recuperación de My Brain LM.

Se encarga de:
- Recibir una pregunta del usuario
- Delegar el retrieval a la estrategia configurada (vector_only/hybrid)
- Construir el prompt con el contexto recuperado
- Llamar a la API de OpenAI para generar la respuesta
- Soportar streaming de la respuesta
"""

from dataclasses import dataclass, field
from typing import Generator, Optional

import chromadb
from openai import OpenAI

from config import settings
from retriever import get_retrieval_strategy, RetrievalResult
from prompts import SYSTEM_PROMPT


@dataclass
class QueryResult:
    """Resultado de una consulta al sistema RAG.

    Attributes:
        answer: Respuesta generada por el LLM.
        sources: Lista de fuentes (nombre de archivo + chunk index) utilizadas.
        context_chunks: Los textos de los chunks que sirvieron como contexto.
    """

    answer: str = ""
    sources: list[dict] = field(default_factory=list)
    context_chunks: list[str] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    model_used: str = ""


def _get_openai_client() -> OpenAI:
    """Crea y retorna un cliente de OpenAI configurado."""
    kwargs = {"api_key": settings.openai_api_key}
    if settings.openai_base_url:
        kwargs["base_url"] = settings.openai_base_url
    return OpenAI(**kwargs)


def _get_chroma_collection() -> chromadb.Collection:
    """Recupera la colección de ChromaDB.

    Returns:
        La colección de ChromaDB configurada.

    Raises:
        ValueError: Si la colección no existe (no se han ingestado documentos).
    """
    client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
    try:
        collection = client.get_collection(name=settings.collection_name)
    except Exception:
        raise ValueError(
            "No se encontró la colección de documentos. "
            "Primero ingesta documentos usando: python main.py ingest <ruta>"
        )
    return collection


def _build_context_prompt(context_chunks: list[str], sources: list[dict]) -> str:
    """Construye el bloque de contexto para incluir en el prompt.

    Numera cada chunk e incluye su fuente para facilitar la citación.

    Args:
        context_chunks: Lista de textos de los chunks recuperados.
        sources: Lista de metadatos de los chunks.

    Returns:
        Cadena formateada con todo el contexto.
    """
    if not context_chunks:
        return "No relevant context was found in the documents."

    context_parts: list[str] = []
    for i, (chunk, source) in enumerate(zip(context_chunks, sources), 1):
        source_name = source.get("source", "unknown")
        context_parts.append(
            f"--- Chunk {i} (Source: {source_name}) ---\n{chunk}"
        )

    return "\n\n".join(context_parts)


def _retrieve_and_build_sources(
    question: str,
    top_k: int = 5,
    strategy_name: Optional[str] = None,
    collection_name: Optional[str] = None
) -> tuple[list[str], list[dict]]:
    """Ejecuta el retrieval usando la estrategia configurada y formatea las fuentes.

    Args:
        question: Pregunta del usuario.
        top_k: Número de chunks a recuperar.
        strategy_name: Nombre de la estrategia a usar. Si es None, usa la configurada.
        collection_name: Nombre de la colección ChromaDB a consultar.

    Returns:
        Tupla con (lista de textos de chunks, lista de metadatos formateados).
    """
    strategy = get_retrieval_strategy(strategy_name)
    result = strategy.retrieve(question, top_k=top_k, collection_name=collection_name)

    # Formatear las fuentes con scores de relevancia
    sources = []
    for meta, score in zip(result.metadatas, result.scores):
        source_info = {
            "source": meta.get("source", "desconocido"),
            "chunk_index": meta.get("chunk_index", -1),
            "file_type": meta.get("file_type", ""),
            "relevance_score": round(score, 4),
        }
        sources.append(source_info)

    return result.documents, sources


def query(
    question: str,
    top_k: int = 5,
    strategy_name: Optional[str] = None,
    collection_name: Optional[str] = None,
    chat_history: Optional[list[dict]] = None
) -> QueryResult:
    """Realiza una consulta completa al sistema RAG (sin streaming).

    Args:
        question: Pregunta del usuario.
        top_k: Número de chunks a recuperar para el contexto.
        strategy_name: Nombre de estrategia de retrieval. None = usa la configurada.
        collection_name: Nombre de la colección ChromaDB a consultar.
        chat_history: Lista de mensajes previos [{"role": ..., "content": ...}]
                      para memoria conversacional. Se inyectan entre el system
                      prompt y el mensaje actual del usuario.

    Returns:
        Objeto QueryResult con la respuesta, fuentes y chunks de contexto.
    """
    openai_client = _get_openai_client()

    # Paso 1-2: Retrieval usando la estrategia configurada
    context_chunks, sources = _retrieve_and_build_sources(
        question, top_k, strategy_name, collection_name=collection_name
    )

    # Paso 3: Construir el prompt completo
    context_text = _build_context_prompt(context_chunks, sources)
    user_message = (
        f"Context from my documents:\n\n{context_text}\n\n"
        f"---\n\n"
        f"Question: {question}"
    )

    # Paso 4: Construir lista de mensajes con historial conversacional
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inyectar historial previo (sin contexto RAG, solo texto plano)
    if chat_history:
        messages.extend(chat_history)

    # Mensaje actual del usuario con contexto RAG fresco
    messages.append({"role": "user", "content": user_message})

    # Paso 5: Llamar al LLM
    response = openai_client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        temperature=0.3,  # Baja temperatura para respuestas más fieles al contexto
    )

    answer = response.choices[0].message.content or ""
    
    input_tokens = 0
    output_tokens = 0
    cost_usd = 0.0
    if response.usage:
        usage = response.usage
        input_tokens = getattr(usage, "prompt_tokens", 0) or 0
        output_tokens = getattr(usage, "completion_tokens", 0) or 0
        if hasattr(usage, "cost"):
            cost_usd = float(usage.cost or 0.0)
        else:
            model_extra = getattr(usage, "model_extra", None)
            if model_extra and "cost" in model_extra:
                cost_usd = float(model_extra["cost"] or 0.0)
            else:
                try:
                    from pricing import get_model_info
                    info = get_model_info(settings.llm_model)
                    cost_usd = (input_tokens * info["prompt_price"]) + (output_tokens * info["completion_price"])
                except Exception:
                    pass

    return QueryResult(
        answer=answer,
        sources=sources,
        context_chunks=context_chunks,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
        model_used=settings.llm_model,
    )


def query_stream(
    question: str,
    top_k: int = 5,
    strategy_name: Optional[str] = None,
    collection_name: Optional[str] = None,
    chat_history: Optional[list[dict]] = None
) -> Generator[tuple[str, Optional[QueryResult], Optional[str]], None, None]:
    """Realiza una consulta con streaming de la respuesta.

    Genera tokens uno a uno mientras el LLM produce la respuesta.
    El último valor generado incluye el QueryResult completo.

    Args:
        question: Pregunta del usuario.
        top_k: Número de chunks a recuperar para el contexto.
        strategy_name: Nombre de la estrategia a usar.
        collection_name: Nombre de la colección ChromaDB a consultar.
        chat_history: Lista de mensajes previos [{"role": ..., "content": ...}]
                      para memoria conversacional. Se inyectan entre el system
                      prompt y el mensaje actual del usuario.

    Yields:
        Tuplas de (token, result, status) donde:
        - token: El fragmento de texto generado por el LLM.
        - result: QueryResult completo al finalizar.
        - status: Estado del procesamiento ("Searching your documents...", "Synthesizing response...", etc.)
    """
    openai_client = _get_openai_client()

    # yield status: Searching documents
    yield "", None, "Searching your documents..."

    # Paso 1-2: Retrieval usando la estrategia configurada
    context_chunks, sources = _retrieve_and_build_sources(
        question, top_k, strategy_name, collection_name=collection_name
    )

    # Paso 3: Construir el prompt completo
    context_text = _build_context_prompt(context_chunks, sources)
    user_message = (
        f"Context from my documents:\n\n{context_text}\n\n"
        f"---\n\n"
        f"Question: {question}"
    )

    # Paso 4: Construir lista de mensajes con historial conversacional
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inyectar historial previo (sin contexto RAG, solo texto plano)
    if chat_history:
        messages.extend(chat_history)

    # Mensaje actual del usuario con contexto RAG fresco
    messages.append({"role": "user", "content": user_message})

    # yield status: Generating response / Synthesizing
    yield "", None, "Synthesizing response..."

    # Paso 5: Llamar al LLM con streaming
    stream = openai_client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        temperature=0.3,
        stream=True,
        stream_options={"include_usage": True},
    )

    # Acumular la respuesta completa mientras hacemos streaming
    full_answer_parts: list[str] = []
    input_tokens = 0
    output_tokens = 0
    cost_usd = 0.0

    for chunk in stream:
        if chunk.choices:
            delta = chunk.choices[0].delta
            if delta.content:
                full_answer_parts.append(delta.content)
                yield delta.content, None, None
        
        if hasattr(chunk, "usage") and chunk.usage:
            usage = chunk.usage
            input_tokens = getattr(usage, "prompt_tokens", 0) or 0
            output_tokens = getattr(usage, "completion_tokens", 0) or 0
            if hasattr(usage, "cost"):
                cost_usd = float(usage.cost or 0.0)
            else:
                model_extra = getattr(usage, "model_extra", None)
                if model_extra and "cost" in model_extra:
                    cost_usd = float(model_extra["cost"] or 0.0)
                else:
                    try:
                        from pricing import get_model_info
                        info = get_model_info(settings.llm_model)
                        cost_usd = (input_tokens * info["prompt_price"]) + (output_tokens * info["completion_price"])
                    except Exception:
                        pass

    # Al finalizar, generar el resultado completo
    full_answer = "".join(full_answer_parts)
    result = QueryResult(
        answer=full_answer,
        sources=sources,
        context_chunks=context_chunks,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
        model_used=settings.llm_model,
    )
    yield "", result, None


def generate_title_from_question(question: str) -> str:
    """Genera un título corto a partir de la primera pregunta del usuario."""
    try:
        openai_client = _get_openai_client()
        response = openai_client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an assistant that summarizes the first question of a chat into a short and concise title. "
                        "Generate a title of maximum 5 words in the same language as the question. "
                        "Respond ONLY with the title, without quotes, without a final period, and without introductions."
                    ),
                },
                {"role": "user", "content": question},
            ],
            temperature=0.5,
            max_tokens=25,
        )
        title = response.choices[0].message.content.strip()
        # Limpiar posibles comillas
        if title.startswith('"') and title.endswith('"'):
            title = title[1:-1].strip()
        if title.startswith("'") and title.endswith("'"):
            title = title[1:-1].strip()
        return title[:50]  # Limitar largo por seguridad
    except Exception as e:
        print(f"Error al generar título con LLM: {e}")
        # Fallback seguro
        fallback = question.strip()
        if len(fallback) > 30:
            return fallback[:30] + "..."
        return fallback


def get_collection_stats(collection_name: Optional[str] = None) -> dict:
    """Obtiene estadísticas de la colección de ChromaDB.

    Args:
        collection_name: Nombre de la colección a consultar.

    Returns:
        Diccionario con:
        - total_chunks: número total de chunks almacenados
        - sources: conjunto de fuentes únicas
        - collection_name: nombre de la colección
    """
    name = collection_name or settings.collection_name
    try:
        client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
        collection = client.get_collection(name=name)
        count = collection.count()

        # Obtener fuentes únicas (si hay documentos)
        unique_sources: set[str] = set()
        if count > 0:
            # Obtener todos los metadatos para extraer fuentes únicas
            all_data = collection.get(include=["metadatas"])
            if all_data["metadatas"]:
                for meta in all_data["metadatas"]:
                    source = meta.get("source", "")
                    if source:
                        unique_sources.add(source)

        return {
            "total_chunks": count,
            "sources": sorted(unique_sources),
            "collection_name": name,
        }
    except Exception:
        return {
            "total_chunks": 0,
            "sources": [],
            "collection_name": name,
        }
