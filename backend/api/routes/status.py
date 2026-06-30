"""
Endpoints de estado y estadísticas de My Brain LM.

GET /api/status — Retorna estadísticas de la colección y configuración activa.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from datetime import datetime, timedelta

from config import settings
from query import get_collection_stats
from api.database import get_session
from api.schemas import StatusResponse
from api.models import Area, Message
import pricing

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


@router.get("/model-info")
def get_model_info_route():
    """Retorna información y precios del modelo LLM configurado."""
    model_id = settings.llm_model
    info = pricing.get_model_info(model_id)
    return {
        "name": info["name"],
        "context_length": info["context_length"],
        "prompt_price": info["prompt_price"],
        "completion_price": info["completion_price"]
    }


@router.get("/usage/summary")
def get_usage_summary(session: Session = Depends(get_session)):
    """Obtiene un resumen de tokens consumidos y costos acumulados."""
    stmt = select(Message)
    messages = session.exec(stmt).all()
    
    total_input = sum(msg.input_tokens for msg in messages)
    total_output = sum(msg.output_tokens for msg in messages)
    total_cost = sum(msg.cost_usd for msg in messages)
    
    # Calcular costos por período (hoy, esta semana, este mes)
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = datetime(now.year, now.month, 1)
    
    cost_today = sum(msg.cost_usd for msg in messages if msg.created_at >= today_start)
    cost_week = sum(msg.cost_usd for msg in messages if msg.created_at >= week_start)
    cost_month = sum(msg.cost_usd for msg in messages if msg.created_at >= month_start)
    
    return {
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_cost_usd": total_cost,
        "period_costs": {
            "today": cost_today,
            "this_week": cost_week,
            "this_month": cost_month
        }
    }
