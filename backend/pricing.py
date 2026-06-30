"""
Módulo de precios dinámicos para modelos LLM.

Consulta OpenRouter /api/v1/models para obtener precios y context window
actualizados. Cachea los resultados para evitar llamadas repetitivas.
"""
import time
import logging
import httpx
from config import settings

logger = logging.getLogger("mybrain.pricing")

# Cache en memoria: { model_id: { data, fetched_at } }
_model_cache: dict = {}
_CACHE_TTL = 3600  # 1 hora

def get_model_info(model_id: str) -> dict:
    """Obtiene pricing + context_length para un modelo de OpenRouter.
    
    Returns:
        {
            "prompt_price": 0.00000015,   # USD per token
            "completion_price": 0.0000006,
            "context_length": 128000,
            "name": "GPT-4o Mini"
        }
    """
    cached = _model_cache.get(model_id)
    if cached and (time.time() - cached["fetched_at"]) < _CACHE_TTL:
        return cached["data"]
    
    # URL base para la consulta de modelos
    base_url = settings.openai_base_url or "https://openrouter.ai/api/v1"
    # Asegurarnos de que termine correctamente para la API de OpenRouter
    if base_url.endswith("/chat/completions"):
        base_url = base_url.replace("/chat/completions", "")
    elif base_url.endswith("/"):
        base_url = base_url[:-1]
        
    models_url = f"{base_url}/models"
    
    headers = {}
    if settings.openai_api_key:
        headers["Authorization"] = f"Bearer {settings.openai_api_key}"
        
    try:
        logger.info(f"Consultando catálogo de modelos de OpenRouter: {models_url}")
        resp = httpx.get(models_url, headers=headers, timeout=10.0)
        resp.raise_for_status()
        
        models_data = resp.json().get("data", [])
        for model in models_data:
            if model.get("id") == model_id:
                pricing = model.get("pricing", {})
                data = {
                    "prompt_price": float(pricing.get("prompt", 0.0)),
                    "completion_price": float(pricing.get("completion", 0.0)),
                    "context_length": int(model.get("context_length", 128000)),
                    "name": model.get("name", model_id),
                }
                _model_cache[model_id] = {"data": data, "fetched_at": time.time()}
                return data
                
    except Exception as e:
        logger.error(f"Error al obtener info de modelo de OpenRouter: {e}")
        
    # Fallback si el modelo no se encuentra o la llamada falla
    # Intentamos adivinar valores estándar basados en el id
    context_len = 128000
    if "claude-3-5" in model_id:
        context_len = 200000
    elif "gemini-1.5" in model_id:
        context_len = 2000000
    elif "gemini-2" in model_id:
        context_len = 2000000
        
    fallback_data = {
        "prompt_price": 0.0,
        "completion_price": 0.0,
        "context_length": context_len,
        "name": model_id.split("/")[-1] if "/" in model_id else model_id
    }
    return fallback_data
