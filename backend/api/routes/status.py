"""
Endpoints de estado y estadísticas de My Brain LM.

GET /api/status — Retorna estadísticas de la colección y configuración activa.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select

from config import settings
from query import get_collection_stats
from api.database import get_session
from api.schemas import StatusResponse
from api.models import Area

router = APIRouter(prefix="/api", tags=["Status"])


@router.get(
    "/status",
    response_model=StatusResponse,
    summary="Estado del sistema",
    description="Retorna estadísticas agrupadas de todas las colecciones de ChromaDB y configuración activa.",
)
async def get_status(session: Session = Depends(get_session)):
    """Obtiene el estado actual del sistema RAG agregando todas las áreas."""
    try:
        areas = session.exec(select(Area)).all()
        
        total_chunks = 0
        all_sources = set()
        
        # Consultar ChromaDB para cada colección de Área
        for area in areas:
            collection_name = f"mybrain_area_{area.id}"
            try:
                stats = get_collection_stats(collection_name)
                total_chunks += stats.get("total_chunks", 0)
                for src in stats.get("sources", []):
                    all_sources.add(src)
            except Exception:
                # La colección no existe en Chroma aún, ignoramos
                pass
        
        # Agregar la colección general por defecto por compatibilidad
        try:
            default_stats = get_collection_stats(settings.collection_name)
            total_chunks += default_stats.get("total_chunks", 0)
            for src in default_stats.get("sources", []):
                all_sources.add(src)
        except Exception:
            pass

        return StatusResponse(
            collection_name="All Areas (Aggregate)",
            total_chunks=total_chunks,
            total_documents=len(all_sources),
            sources=sorted(list(all_sources)),
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
