"""
Modelos de datos SQLModel para My Brain LM.

Define la estructura de tablas para Áreas, Documentos, Conversaciones y Mensajes
utilizando identificadores UUIDv4 profesionales (strings) para Áreas y Conversaciones.
"""

import uuid
from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class AreaBase(SQLModel):
    name: str = Field(index=True, description="Nombre del área de conocimiento")
    description: Optional[str] = Field(default=None, description="Descripción del área")
    color: Optional[str] = Field(default="#3B82F6", description="Color en formato HEX para la UI")


class Area(AreaBase, table=True):
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
        description="ID único del área (UUIDv4)"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relaciones con borrado en cascada
    documents: List["Document"] = Relationship(
        back_populates="area",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )
    conversations: List["Conversation"] = Relationship(
        back_populates="area",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class DocumentBase(SQLModel):
    filename: str = Field(description="Nombre del archivo original")
    file_path: str = Field(description="Ruta física donde se almacena el archivo")
    file_size: int = Field(description="Tamaño del archivo en bytes")
    area_id: str = Field(foreign_key="area.id", index=True, description="ID del área a la que pertenece (UUIDv4)")


class Document(DocumentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relación inversa
    area: Area = Relationship(back_populates="documents")


class ConversationBase(SQLModel):
    title: str = Field(description="Título o asunto de la conversación")
    area_id: str = Field(foreign_key="area.id", index=True, description="ID del área de la conversación (UUIDv4)")


class Conversation(ConversationBase, table=True):
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        primary_key=True,
        description="ID único de la conversación (UUIDv4)"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relaciones
    area: Area = Relationship(back_populates="conversations")
    messages: List["Message"] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class MessageBase(SQLModel):
    role: str = Field(description="Rol del emisor: 'user' o 'assistant'")
    content: str = Field(description="Contenido del mensaje")
    sources_json: Optional[str] = Field(
        default=None,
        description="JSON serializado con las fuentes RAG utilizadas (para respuestas del asistente)"
    )
    conversation_id: str = Field(
        foreign_key="conversation.id",
        index=True,
        description="ID de la conversación a la que pertenece (UUIDv4)"
    )


class Message(MessageBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relación inversa
    conversation: Conversation = Relationship(back_populates="messages")
