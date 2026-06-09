"""
Módulo de consulta y recuperación de MyBrain.

Se encarga de:
- Recibir una pregunta del usuario
- Generar el embedding de la pregunta
- Buscar los chunks más relevantes en ChromaDB
- Construir el prompt con el contexto recuperado
- Llamar a la API de OpenAI para generar la respuesta
- Soportar streaming de la respuesta
"""

from dataclasses import dataclass, field
from typing import Generator, Optional

import chromadb
from openai import OpenAI

from config import settings


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


# Prompt del sistema — instruye al LLM a responder solo con base en el contexto
SYSTEM_PROMPT = """Eres un asistente de conocimiento personal llamado MyBrain. Tu trabajo es responder preguntas basándote ÚNICAMENTE en el contexto proporcionado.

Reglas estrictas:
1. Responde SOLO con información presente en el contexto proporcionado.
2. Si el contexto no contiene suficiente información para responder, di claramente: "No tengo suficiente información en mis documentos para responder esa pregunta."
3. Cita las fuentes al final de tu respuesta indicando el nombre del archivo de donde proviene la información.
4. Sé conciso pero completo en tus respuestas.
5. Si la pregunta es ambigua, menciona las posibles interpretaciones basándote en el contexto.
6. Responde en el mismo idioma en que se hizo la pregunta.

Formato de citación:
- Al final de la respuesta, agrega una sección "📚 Fuentes:" listando los archivos utilizados.
"""


def _get_openai_client() -> OpenAI:
    """Crea y retorna un cliente de OpenAI configurado."""
    return OpenAI(api_key=settings.openai_api_key)


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


def _generate_query_embedding(question: str, client: OpenAI) -> list[float]:
    """Genera el embedding para la pregunta del usuario.

    Args:
        question: Pregunta del usuario.
        client: Cliente de OpenAI.

    Returns:
        Vector de embedding de la pregunta.
    """
    response = client.embeddings.create(
        input=[question],
        model=settings.embedding_model,
    )
    return response.data[0].embedding


def _retrieve_context(
    question_embedding: list[float], top_k: int = 5
) -> tuple[list[str], list[dict]]:
    """Busca los chunks más relevantes en ChromaDB.

    Args:
        question_embedding: Embedding de la pregunta del usuario.
        top_k: Número máximo de chunks a recuperar.

    Returns:
        Tupla con (lista de textos de chunks, lista de metadatos).
    """
    collection = _get_chroma_collection()

    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    # Extraer documentos y metadatos de los resultados
    documents = results["documents"][0] if results["documents"] else []
    metadatas = results["metadatas"][0] if results["metadatas"] else []
    distances = results["distances"][0] if results["distances"] else []

    # Enriquecer metadatos con la distancia (relevancia)
    sources = []
    for meta, dist in zip(metadatas, distances):
        source_info = {
            "source": meta.get("source", "desconocido"),
            "chunk_index": meta.get("chunk_index", -1),
            "file_type": meta.get("file_type", ""),
            "relevance_score": round(1 - dist, 4),  # Convertir distancia coseno a similitud
        }
        sources.append(source_info)

    return documents, sources


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
        return "No se encontró contexto relevante en los documentos."

    context_parts: list[str] = []
    for i, (chunk, source) in enumerate(zip(context_chunks, sources), 1):
        source_name = source.get("source", "desconocido")
        context_parts.append(
            f"--- Fragmento {i} (Fuente: {source_name}) ---\n{chunk}"
        )

    return "\n\n".join(context_parts)


def query(question: str, top_k: int = 5) -> QueryResult:
    """Realiza una consulta completa al sistema RAG (sin streaming).

    Args:
        question: Pregunta del usuario.
        top_k: Número de chunks a recuperar para el contexto.

    Returns:
        Objeto QueryResult con la respuesta, fuentes y chunks de contexto.
    """
    openai_client = _get_openai_client()

    # Paso 1: Generar embedding de la pregunta
    question_embedding = _generate_query_embedding(question, openai_client)

    # Paso 2: Recuperar contexto relevante
    context_chunks, sources = _retrieve_context(question_embedding, top_k)

    # Paso 3: Construir el prompt completo
    context_text = _build_context_prompt(context_chunks, sources)
    user_message = (
        f"Contexto de mis documentos:\n\n{context_text}\n\n"
        f"---\n\n"
        f"Pregunta: {question}"
    )

    # Paso 4: Llamar al LLM
    response = openai_client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,  # Baja temperatura para respuestas más fieles al contexto
    )

    answer = response.choices[0].message.content or ""

    return QueryResult(
        answer=answer,
        sources=sources,
        context_chunks=context_chunks,
    )


def query_stream(
    question: str, top_k: int = 5
) -> Generator[tuple[str, Optional[QueryResult]], None, None]:
    """Realiza una consulta con streaming de la respuesta.

    Genera tokens uno a uno mientras el LLM produce la respuesta.
    El último valor generado incluye el QueryResult completo.

    Args:
        question: Pregunta del usuario.
        top_k: Número de chunks a recuperar para el contexto.

    Yields:
        Tuplas de (token, result) donde result es None hasta el último
        token, donde contiene el QueryResult completo.
    """
    openai_client = _get_openai_client()

    # Paso 1: Generar embedding de la pregunta
    question_embedding = _generate_query_embedding(question, openai_client)

    # Paso 2: Recuperar contexto relevante
    context_chunks, sources = _retrieve_context(question_embedding, top_k)

    # Paso 3: Construir el prompt completo
    context_text = _build_context_prompt(context_chunks, sources)
    user_message = (
        f"Contexto de mis documentos:\n\n{context_text}\n\n"
        f"---\n\n"
        f"Pregunta: {question}"
    )

    # Paso 4: Llamar al LLM con streaming
    stream = openai_client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
        stream=True,
    )

    # Acumular la respuesta completa mientras hacemos streaming
    full_answer_parts: list[str] = []

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            full_answer_parts.append(delta.content)
            yield delta.content, None

    # Al finalizar, generar el resultado completo
    full_answer = "".join(full_answer_parts)
    result = QueryResult(
        answer=full_answer,
        sources=sources,
        context_chunks=context_chunks,
    )
    yield "", result


def get_collection_stats() -> dict:
    """Obtiene estadísticas de la colección de ChromaDB.

    Returns:
        Diccionario con:
        - total_chunks: número total de chunks almacenados
        - sources: conjunto de fuentes únicas
        - collection_name: nombre de la colección
    """
    try:
        client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
        collection = client.get_collection(name=settings.collection_name)
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
            "collection_name": settings.collection_name,
        }
    except Exception:
        return {
            "total_chunks": 0,
            "sources": [],
            "collection_name": settings.collection_name,
        }
