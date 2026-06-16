"""
Módulo de estrategias de recuperación (retrieval) para My Brain LM RAG.

Implementa dos estrategias intercambiables:
- VectorOnlyStrategy: búsqueda puramente semántica vía embeddings.
- HybridStrategy: fusión de BM25 (léxico) + embeddings (semántico) con
  Reciprocal Rank Fusion (RRF).

Uso:
    from retriever import get_retrieval_strategy, RetrievalResult
    strategy = get_retrieval_strategy()  # usa settings.retrieval_strategy
    result: RetrievalResult = strategy.retrieve("¿Qué es RAG?", top_k=5)
"""

import re
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

import chromadb
from openai import OpenAI
from rank_bm25 import BM25Okapi

from config import settings


# ---------------------------------------------------------------------------
# Resultado de la recuperación
# ---------------------------------------------------------------------------

@dataclass
class RetrievalResult:
    """Resultado estandarizado devuelto por cualquier estrategia de retrieval.

    Attributes:
        documents: Textos de los chunks recuperados.
        metadatas: Metadatos asociados a cada chunk.
        scores: Puntuaciones de relevancia (0-1, mayor = más relevante).
    """

    documents: list[str] = field(default_factory=list)
    metadatas: list[dict] = field(default_factory=list)
    scores: list[float] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Clase base abstracta
# ---------------------------------------------------------------------------

class RetrieverStrategy(ABC):
    """Interfaz abstracta para las estrategias de recuperación."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Nombre identificador de la estrategia."""
        ...

    @abstractmethod
    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        collection_name: Optional[str] = None
    ) -> RetrievalResult:
        """Recupera los chunks más relevantes para la consulta dada.

        Args:
            query: Pregunta o texto de búsqueda del usuario.
            top_k: Cantidad máxima de resultados a devolver.
            collection_name: Nombre de la colección ChromaDB a consultar.

        Returns:
            RetrievalResult con los documentos, metadatos y scores.
        """
        ...


# ---------------------------------------------------------------------------
# Funciones auxiliares compartidas
# ---------------------------------------------------------------------------

def _get_openai_client() -> OpenAI:
    """Crea un cliente de OpenAI con la API key configurada."""
    return OpenAI(api_key=settings.openai_api_key)


def _get_chroma_collection(collection_name: Optional[str] = None) -> chromadb.Collection:
    """Obtiene la colección de ChromaDB configurada o una específica por nombre.

    Returns:
        Colección de ChromaDB lista para consultas.

    Raises:
        ValueError: Si la colección no existe (no se han ingestado documentos).
    """
    client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
    name = collection_name or settings.collection_name
    try:
        collection = client.get_collection(name=name)
    except Exception:
        raise ValueError(
            f"No se encontró la colección de documentos '{name}'. "
            "Primero ingesta documentos en esta área."
        )
    return collection


def _generate_embedding(text: str, client: OpenAI) -> list[float]:
    """Genera el vector de embedding para un texto dado.

    Args:
        text: Texto a embeder (pregunta o documento).
        client: Cliente de OpenAI configurado.

    Returns:
        Vector de embedding como lista de floats.
    """
    response = client.embeddings.create(
        input=[text],
        model=settings.embedding_model,
    )
    return response.data[0].embedding


def _vector_search(
    query: str,
    top_k: int,
    client: OpenAI,
    collection: chromadb.Collection,
) -> RetrievalResult:
    """Ejecuta una búsqueda vectorial contra ChromaDB.

    Genera el embedding de la consulta y busca los chunks más cercanos
    por similitud coseno.

    Args:
        query: Texto de búsqueda.
        top_k: Número máximo de resultados.
        client: Cliente de OpenAI.
        collection: Colección de ChromaDB.

    Returns:
        RetrievalResult con documentos ordenados por similitud descendente.
    """
    # Generar embedding de la consulta
    embedding = _generate_embedding(query, client)

    # Consultar ChromaDB por similitud de embedding
    results = collection.query(
        query_embeddings=[embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    # Extraer resultados (ChromaDB anida en listas por cada query)
    documents = results["documents"][0] if results["documents"] else []
    metadatas = results["metadatas"][0] if results["metadatas"] else []
    distances = results["distances"][0] if results["distances"] else []

    # Convertir distancia coseno a score de similitud (1 - distancia)
    scores = [round(1.0 - d, 4) for d in distances]

    return RetrievalResult(
        documents=documents,
        metadatas=metadatas,
        scores=scores,
    )


# ---------------------------------------------------------------------------
# Tokenizador personalizado para BM25
# ---------------------------------------------------------------------------

def _tokenize_for_bm25(text: str) -> list[str]:
    """Tokeniza texto para BM25 preservando identificadores de código.

    Convierte a minúsculas y extrae tokens alfanuméricos que pueden contener
    guiones bajos y puntos internos (ej. create_deep_agent,
    bm25retriever.from_documents). Los números puros también se conservan.

    Args:
        text: Texto a tokenizar.

    Returns:
        Lista de tokens en minúsculas.
    """
    # Patrón: identificadores (letras/guion_bajo seguidos de letras/dígitos/puntos/guion_bajo)
    # o secuencias puramente numéricas
    return re.findall(r"[a-zA-Z_][a-zA-Z0-9_.]*|\d+", text.lower())


# ---------------------------------------------------------------------------
# Gestor de caché en memoria para BM25 (Thread-Safe Singleton)
# ---------------------------------------------------------------------------

class BM25CacheManager:
    """Administrador de caché en memoria RAM para índices BM25.

    Almacena los índices calculados y los metadatos de los documentos
    para evitar recuperarlos de ChromaDB y reconstruir el índice en cada query.
    Esta clase es segura para acceso concurrente mediante locks.
    """

    def __init__(self) -> None:
        # Cache mapea: collection_name -> {
        #    "bm25_index": BM25Okapi,
        #    "documents": list[str],
        #    "metadatas": list[dict]
        # }
        self._cache: dict[str, dict] = {}
        self._lock = threading.Lock()

    def get_bm25_index(
        self,
        collection_name: str,
        collection: chromadb.Collection,
    ) -> tuple[Optional[BM25Okapi], list[str], list[dict]]:
        """Obtiene el índice BM25 para una colección específica.

        Si ya está en caché, lo devuelve inmediatamente. Si no, lee de
        ChromaDB, construye el índice, lo guarda en caché y lo devuelve.
        """
        # Intentar una lectura rápida sin lock (optimista)
        if collection_name in self._cache:
            cached = self._cache[collection_name]
            return cached["bm25_index"], cached["documents"], cached["metadatas"]

        # Si no está en caché, adquirir lock para construir
        with self._lock:
            # Volver a comprobar por si otro hilo lo calculó mientras esperábamos el lock
            if collection_name in self._cache:
                cached = self._cache[collection_name]
                return cached["bm25_index"], cached["documents"], cached["metadatas"]

            # Obtener todos los documentos de la colección
            all_data = collection.get(include=["documents", "metadatas"])
            all_documents: list[str] = all_data["documents"] or []
            all_metadatas: list[dict] = all_data["metadatas"] or []

            # Si no hay documentos, no creamos índice pero retornamos listas vacías
            if not all_documents:
                return None, [], []

            # Tokenizar todos los documentos para el corpus BM25
            tokenized_corpus: list[list[str]] = [
                _tokenize_for_bm25(doc) for doc in all_documents
            ]

            # Caso borde: todos los documentos se tokenizaron a listas vacías
            if all(len(tokens) == 0 for tokens in tokenized_corpus):
                return None, all_documents, all_metadatas

            # Crear índice BM25
            bm25_index = BM25Okapi(tokenized_corpus)

            # Guardar en caché
            self._cache[collection_name] = {
                "bm25_index": bm25_index,
                "documents": all_documents,
                "metadatas": all_metadatas,
            }

            return bm25_index, all_documents, all_metadatas

    def invalidate(self, collection_name: str) -> None:
        """Invalida/elimina la caché para una colección específica."""
        with self._lock:
            if collection_name in self._cache:
                del self._cache[collection_name]

    def clear(self) -> None:
        """Limpia toda la caché en memoria."""
        with self._lock:
            self._cache.clear()


# Instancia singleton global
bm25_cache_manager = BM25CacheManager()


# ---------------------------------------------------------------------------
# Estrategia: Solo vectores (embeddings)
# ---------------------------------------------------------------------------

class VectorOnlyStrategy(RetrieverStrategy):
    """Estrategia de recuperación basada únicamente en similitud de embeddings.

    Genera el embedding de la consulta con OpenAI y busca los chunks más
    cercanos en ChromaDB usando distancia coseno.
    """

    @property
    def name(self) -> str:
        """Nombre identificador de la estrategia."""
        return "vector_only"

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        collection_name: Optional[str] = None
    ) -> RetrievalResult:
        """Recupera chunks por similitud semántica con embeddings.

        Args:
            query: Pregunta del usuario.
            top_k: Número de chunks a devolver.
            collection_name: Nombre de la colección ChromaDB a consultar.

        Returns:
            RetrievalResult con los chunks más similares semánticamente.
        """
        client = _get_openai_client()
        collection = _get_chroma_collection(collection_name)
        return _vector_search(query, top_k, client, collection)


# ---------------------------------------------------------------------------
# Estrategia: Híbrida (BM25 + Vector con Reciprocal Rank Fusion)
# ---------------------------------------------------------------------------

class HybridStrategy(RetrieverStrategy):
    """Estrategia híbrida que combina BM25 (léxico) con embeddings (semántico).

    Utiliza Reciprocal Rank Fusion (RRF) para fusionar los rankings de ambos
    métodos, ponderando cada uno según el peso configurado.

    Args:
        bm25_weight: Peso del componente BM25 (0.0-1.0). El peso del vector
            será (1 - bm25_weight). Por defecto usa settings.retrieval_bm25_weight.
    """

    def __init__(self, bm25_weight: float | None = None) -> None:
        # Peso para el componente BM25 en la fusión RRF
        self._bm25_weight: float = (
            bm25_weight if bm25_weight is not None else settings.retrieval_bm25_weight
        )

    @property
    def name(self) -> str:
        """Nombre identificador de la estrategia."""
        w_bm25 = int(round(self._bm25_weight * 100))
        w_vector = 100 - w_bm25
        return f"hybrid_{w_bm25}_{w_vector}"

    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        collection_name: Optional[str] = None
    ) -> RetrievalResult:
        """Recupera chunks fusionando resultados de BM25 y búsqueda vectorial.

        Ejecuta ambas búsquedas en paralelo (conceptualmente), luego combina
        los rankings con Reciprocal Rank Fusion (RRF) ponderada.

        Args:
            query: Pregunta del usuario.
            top_k: Número de chunks a devolver tras la fusión.
            collection_name: Nombre de la colección ChromaDB a consultar.

        Returns:
            RetrievalResult con los chunks mejor rankeados por RRF ponderado.
        """
        client = _get_openai_client()
        collection = _get_chroma_collection(collection_name)

        # --- Parte BM25: búsqueda léxica ---
        bm25_results = self._bm25_search(query, top_k, collection)

        # --- Parte Vectorial: búsqueda semántica ---
        vector_results = _vector_search(query, top_k, client, collection)

        # --- Fusión con RRF ponderado ---
        fused = self._reciprocal_rank_fusion(
            bm25_results=bm25_results,
            vector_results=vector_results,
            top_k=top_k,
        )

        return fused

    def _bm25_search(
        self,
        query: str,
        top_k: int,
        collection: chromadb.Collection,
    ) -> RetrievalResult:
        """Ejecuta búsqueda BM25 sobre todos los documentos de la colección.

        Obtiene el índice BM25 desde la caché (o lo calcula si es necesario)
        y devuelve los chunks más relevantes según la consulta tokenizada.

        Args:
            query: Texto de búsqueda.
            top_k: Número máximo de resultados.
            collection: Colección de ChromaDB.

        Returns:
            RetrievalResult con los chunks mejor rankeados por BM25.
        """
        # Obtener colección por nombre para la caché
        collection_name = collection.name

        # Recuperar de la caché en memoria RAM
        bm25_index, all_documents, all_metadatas = bm25_cache_manager.get_bm25_index(
            collection_name, collection
        )

        # Caso borde: colección vacía o sin índice válido
        if not bm25_index or not all_documents:
            return RetrievalResult()

        # Tokenizar la consulta y obtener scores
        tokenized_query = _tokenize_for_bm25(query)

        # Caso borde: la consulta no produce tokens
        if not tokenized_query:
            return RetrievalResult()

        # Obtener scores BM25 para todos los documentos
        raw_scores = bm25_index.get_scores(tokenized_query)

        # Ordenar por score descendente y tomar top_k
        scored_indices = sorted(
            range(len(raw_scores)),
            key=lambda i: raw_scores[i],
            reverse=True,
        )[:top_k]

        # Filtrar documentos con score > 0 (sin relevancia)
        documents: list[str] = []
        metadatas: list[dict] = []
        scores: list[float] = []

        for idx in scored_indices:
            if raw_scores[idx] > 0:
                documents.append(all_documents[idx])
                metadatas.append(all_metadatas[idx])
                # Normalizar score BM25 al rango 0-1 usando el máximo
                max_score = raw_scores[scored_indices[0]]
                normalized = round(raw_scores[idx] / max_score, 4) if max_score > 0 else 0.0
                scores.append(normalized)

        return RetrievalResult(
            documents=documents,
            metadatas=metadatas,
            scores=scores,
        )

    def _reciprocal_rank_fusion(
        self,
        bm25_results: RetrievalResult,
        vector_results: RetrievalResult,
        top_k: int,
        k: int = 60,
    ) -> RetrievalResult:
        """Fusiona dos listas de resultados usando Reciprocal Rank Fusion.

        Para cada documento que aparece en alguna de las listas, calcula:
            rrf_score = bm25_weight * (1 / (k + rank_bm25))
                      + vector_weight * (1 / (k + rank_vector))

        donde k=60 es la constante estándar de RRF.

        Args:
            bm25_results: Resultados de la búsqueda BM25.
            vector_results: Resultados de la búsqueda vectorial.
            top_k: Número máximo de resultados finales.
            k: Constante de suavizado para RRF (default=60).

        Returns:
            RetrievalResult fusionado ordenado por score RRF descendente.
        """
        vector_weight = 1.0 - self._bm25_weight

        # Mapa: contenido del documento -> {doc, metadata, rrf_score}
        # Usamos el contenido del documento como clave para identificar duplicados
        fusion_map: dict[str, dict] = {}

        # Procesar resultados de BM25 — asignar RRF score ponderado
        for rank, (doc, meta) in enumerate(
            zip(bm25_results.documents, bm25_results.metadatas)
        ):
            rrf_score = self._bm25_weight * (1.0 / (k + rank))
            if doc in fusion_map:
                fusion_map[doc]["rrf_score"] += rrf_score
            else:
                fusion_map[doc] = {
                    "document": doc,
                    "metadata": meta,
                    "rrf_score": rrf_score,
                }

        # Procesar resultados vectoriales — asignar RRF score ponderado
        for rank, (doc, meta) in enumerate(
            zip(vector_results.documents, vector_results.metadatas)
        ):
            rrf_score = vector_weight * (1.0 / (k + rank))
            if doc in fusion_map:
                fusion_map[doc]["rrf_score"] += rrf_score
            else:
                fusion_map[doc] = {
                    "document": doc,
                    "metadata": meta,
                    "rrf_score": rrf_score,
                }

        # Ordenar por score RRF combinado (descendente) y tomar top_k
        sorted_results = sorted(
            fusion_map.values(),
            key=lambda x: x["rrf_score"],
            reverse=True,
        )[:top_k]

        # Construir el resultado final
        return RetrievalResult(
            documents=[r["document"] for r in sorted_results],
            metadatas=[r["metadata"] for r in sorted_results],
            scores=[round(r["rrf_score"], 6) for r in sorted_results],
        )


# ---------------------------------------------------------------------------
# Registro de estrategias y función factoría
# ---------------------------------------------------------------------------

# Registro de estrategias disponibles (nombre -> clase)
_STRATEGY_REGISTRY: dict[str, type[RetrieverStrategy]] = {
    "vector_only": VectorOnlyStrategy,
    "hybrid": HybridStrategy,
}


def get_retrieval_strategy(strategy_name: str | None = None) -> RetrieverStrategy:
    """Obtiene una instancia de la estrategia de retrieval por nombre.

    Si no se especifica nombre, usa el valor de settings.retrieval_strategy.

    Args:
        strategy_name: Nombre de la estrategia ('vector_only' o 'hybrid').
            Si es None, usa la configuración por defecto.

    Returns:
        Instancia de la estrategia solicitada.

    Raises:
        ValueError: Si el nombre de estrategia no está registrado.
    """
    # Usar la estrategia configurada si no se especifica una
    name = strategy_name or settings.retrieval_strategy

    strategy_class = _STRATEGY_REGISTRY.get(name)
    if strategy_class is None:
        available = ", ".join(sorted(_STRATEGY_REGISTRY.keys()))
        raise ValueError(
            f"Estrategia de retrieval '{name}' no reconocida. "
            f"Opciones disponibles: {available}"
        )

    return strategy_class()
