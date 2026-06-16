"""
Aplicación FastAPI de My Brain LM.

Punto de entrada de la API REST. Configura CORS, registra routers
y define metadata de la documentación OpenAPI.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import status, ingest, chat, areas
from api.database import create_db_and_tables

# =====================================================================
# Crear la aplicación FastAPI
# =====================================================================

app = FastAPI(
    title="My Brain LM API",
    description=(
        "🧠 API REST de My Brain LM — your docs, your local intelligence.\n\n"
        "Permite ingestar documentos, consultarlos via RAG con streaming, "
        "y verificar el estado del sistema."
    ),
    version="1.0.0",
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",     # ReDoc
)

@app.on_event("startup")
def on_startup():
    """Inicializar las tablas de la base de datos SQLite en el arranque."""
    create_db_and_tables()

# =====================================================================
# CORS — Permitir conexiones desde el frontend (Fase 2)
# =====================================================================

import os

env_origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [
    "http://localhost:5173",    # Vite dev server (default)
    "http://localhost:3000",    # Alternativa común
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost",         # Docker local (puerto 80)
    "http://127.0.0.1",         # Docker local (puerto 80)
]
if env_origins:
    allowed_origins.extend([origin.strip() for origin in env_origins.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================================
# Registrar Routers
# =====================================================================

app.include_router(status.router)
app.include_router(ingest.router)
app.include_router(chat.router)
app.include_router(areas.router)



# =====================================================================
# Root endpoint (health check)
# =====================================================================

@app.get("/", tags=["Root"])
async def root():
    """Health check básico."""
    return {
        "app": "My Brain LM API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }
