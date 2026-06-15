"""
Esquemas Pydantic para la API REST de My Brain LM.

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


# =====================================================================
# Schemas de la Fase 3 (Áreas, Documentos, Conversaciones)
# =====================================================================
from datetime import datetime
from typing import Optional

class AreaCreate(BaseModel):
    """Modelo para crear una nueva Área."""
    name: str = Field(..., min_length=1, max_length=100, description="Nombre del área")
    description: Optional[str] = Field(default=None, max_length=500, description="Descripción corta")
    color: Optional[str] = Field(default="#3B82F6", description="Color en HEX (ej. #FF5733)")


class AreaResponse(BaseModel):
    """Modelo de respuesta al listar/detallar un Área."""
    id: str
    name: str
    description: Optional[str]
    color: Optional[str]
    created_at: datetime
    document_count: int = 0
    conversation_count: int = 0

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    """Modelo de respuesta para un documento de un Área."""
    id: int
    filename: str
    file_size: int
    area_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    """Modelo de respuesta para una Conversación."""
    id: str
    title: str
    area_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """Modelo de respuesta para un Mensaje del historial."""
    id: int
    role: str
    content: str
    sources_json: Optional[str]
    conversation_id: str
    created_at: datetime

    class Config:
        from_attributes = True

