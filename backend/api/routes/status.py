"""
Endpoints de estado y estadísticas de MyBrain.

GET /api/status — Retorna estadísticas de la colección y configuración activa.
"""

from fastapi import APIRouter, HTTPException

from config import settings
from query import get_collection_stats
from api.schemas import StatusResponse

router = APIRouter(prefix="/api", tags=["Status"])


@router.get(
    "/status",
    response_model=StatusResponse,
    summary="Estado del sistema",
    description="Retorna estadísticas de la colección de ChromaDB y configuración activa.",
)
async def get_status():
    """Obtiene el estado actual del sistema RAG."""
    try:
        stats = get_collection_stats()
        
        return StatusResponse(
            collection_name=stats["collection_name"],
            total_chunks=stats["total_chunks"],
            total_documents=len(stats["sources"]),
            sources=stats["sources"],
            config={
                "llm_model": settings.llm_model,
                "embedding_model": settings.embedding_model,
                "chunking_strategy": settings.chunking_strategy,
                "retrieval_strategy": settings.retrieval_strategy,
                "retrieval_bm25_weight": settings.retrieval_bm25_weight,
                "chunk_size": settings.chunk_size,
                "chunk_overlap": settings.chunk_overlap,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
