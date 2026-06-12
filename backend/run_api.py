"""
Script de arranque del servidor API de MyBrain.

Ejecutar con:
    python run_api.py

O directamente con uvicorn:
    uvicorn api.app:app --reload --host 127.0.0.1 --port 8000
"""

import uvicorn
from config import settings


def main():
    """Arranca el servidor uvicorn con la configuración de settings."""
    print(f"\n🧠 MyBrain API iniciando en http://{settings.api_host}:{settings.api_port}")
    print(f"📖 Documentación en http://{settings.api_host}:{settings.api_port}/docs\n")
    
    uvicorn.run(
        "api.app:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,  # Hot reload durante desarrollo
    )


if __name__ == "__main__":
    main()
