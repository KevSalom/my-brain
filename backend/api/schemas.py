"""
Esquemas Pydantic para la API REST de MyBrain.

Define los modelos de request y response para todos los endpoints.
"""

from pydantic import BaseModel, Field


# =====================================================================
# Schemas de Ingesta
# =====================================================================

class IngestFileResponse(BaseModel):
    """Respuesta de la ingesta de un archivo individual."""
    filename: str = Field(..., description="Nombre del archivo ingestado")
    chunks: int = Field(..., description="Número de chunks generados")
    message: str = Field(..., description="Mensaje descriptivo del resultado")


class IngestDirectoryResponse(BaseModel):
    """Respuesta de la ingesta de un directorio completo."""
    directory: str = Field(..., description="Ruta del directorio procesado")
    files_processed: int = Field(..., description="Número de archivos procesados")
    total_chunks: int = Field(..., description="Total de chunks generados")
    results: dict[str, int] = Field(
        ..., description="Detalle por archivo: {nombre: chunks}"
    )
    message: str


# =====================================================================
# Schemas de Chat / Consulta
# =====================================================================

class ChatRequest(BaseModel):
    """Request para una consulta al sistema RAG."""
    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Pregunta del usuario"
    )
    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Número de chunks a recuperar para contexto"
    )
    strategy: str | None = Field(
        default=None,
        description="Estrategia de retrieval ('vector_only' o 'hybrid'). None = usa la configurada."
    )


class SourceInfo(BaseModel):
    """Información de una fuente/chunk utilizado en la respuesta."""
    source: str = Field(..., description="Nombre del archivo fuente")
    chunk_index: int = Field(..., description="Índice del chunk en el documento")
    file_type: str = Field(default="", description="Tipo de archivo")
    relevance_score: float = Field(..., description="Score de relevancia (0-1)")


class ChatResponse(BaseModel):
    """Respuesta completa de una consulta RAG (sin streaming)."""
    answer: str = Field(..., description="Respuesta generada por el LLM")
    sources: list[SourceInfo] = Field(
        default_factory=list, description="Fuentes utilizadas"
    )
    context_chunks: list[str] = Field(
        default_factory=list, description="Textos de contexto recuperados"
    )


# =====================================================================
# Schemas de Status
# =====================================================================

class StatusResponse(BaseModel):
    """Respuesta del endpoint de estado."""
    collection_name: str
    total_chunks: int
    total_documents: int = Field(..., description="Número de documentos únicos")
    sources: list[str] = Field(..., description="Lista de archivos ingestados")
    config: dict = Field(..., description="Configuración activa del sistema")


# =====================================================================
# Schema de Error genérico
# =====================================================================

class ErrorResponse(BaseModel):
    """Respuesta de error estándar."""
    detail: str = Field(..., description="Descripción del error")
