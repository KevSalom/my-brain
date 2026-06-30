"""
Script de arranque del servidor API de My Brain LM.

Ejecutar con:
    python run_api.py

O directamente con uvicorn:
    uvicorn api.app:app --reload --host 127.0.0.1 --port 8000
"""

import uvicorn
from config import settings


def main():
    """Arranca el servidor uvicorn con la configuración de settings."""
    try:
        print(f"\n🧠 My Brain LM API iniciando en http://{settings.api_host}:{settings.api_port}")
        print(f"📖 Documentación en http://{settings.api_host}:{settings.api_port}/docs\n")
    except UnicodeEncodeError:
        print(f"\n[Brain] My Brain LM API iniciando en http://{settings.api_host}:{settings.api_port}")
        print(f"[Docs] Documentación en http://{settings.api_host}:{settings.api_port}/docs\n")
    
    import os
    reload_env = os.getenv("API_RELOAD", "true").lower()
    should_reload = reload_env == "true"

    uvicorn.run(
        "api.app:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=should_reload,
    )


if __name__ == "__main__":
    main()
