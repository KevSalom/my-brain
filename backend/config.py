"""
Módulo de configuración de MyBrain.

Carga las variables de entorno desde el archivo .env y expone
una instancia singleton `settings` con todos los parámetros del sistema.
"""

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Cargar variables de entorno desde .env (busca en el directorio del módulo)
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)


@dataclass
class Settings:
    """Configuración centralizada de la aplicación.

    Los valores se leen de las variables de entorno con valores por defecto
    razonables. La única variable obligatoria es OPENAI_API_KEY.
    """

    # --- Claves y modelos de OpenAI ---
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    embedding_model: str = field(
        default_factory=lambda: os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    )
    llm_model: str = field(
        default_factory=lambda: os.getenv("LLM_MODEL", "gpt-4o-mini")
    )

    # --- ChromaDB ---
    chroma_persist_dir: str = field(
        default_factory=lambda: os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    )

    # --- Chunking ---
    chunk_size: int = field(
        default_factory=lambda: int(os.getenv("CHUNK_SIZE", "1000"))
    )
    chunk_overlap: int = field(
        default_factory=lambda: int(os.getenv("CHUNK_OVERLAP", "200"))
    )

    # --- Estrategia de chunking ('basic' o 'smart') ---
    chunking_strategy: str = field(
        default_factory=lambda: os.getenv("CHUNKING_STRATEGY", "smart")
    )

    # --- Estrategia de retrieval ('vector_only' o 'hybrid') ---
    retrieval_strategy: str = field(
        default_factory=lambda: os.getenv("RETRIEVAL_STRATEGY", "hybrid")
    )
    # Peso de BM25 en la estrategia híbrida (0.0 a 1.0). El peso del vector es 1 - este valor.
    retrieval_bm25_weight: float = field(
        default_factory=lambda: float(os.getenv("RETRIEVAL_BM25_WEIGHT", "0.3"))
    )

    # --- Directorio de documentos ---
    documents_dir: str = field(
        default_factory=lambda: os.getenv("DOCUMENTS_DIR", "./documents")
    )

    # --- Nombre de la colección de ChromaDB ---
    collection_name: str = "mybrain_default"

    # --- API REST (Fase 1) ---
    api_host: str = field(
        default_factory=lambda: os.getenv("API_HOST", "127.0.0.1")
    )
    api_port: int = field(
        default_factory=lambda: int(os.getenv("API_PORT", "8000"))
    )

    def __post_init__(self) -> None:
        """Validación post-inicialización.

        Verifica que la API key de OpenAI esté configurada.
        Si no lo está, muestra un mensaje claro y termina el programa.
        """
        if not self.openai_api_key or self.openai_api_key == "your-api-key-here":
            print(
                "\n❌ ERROR: OPENAI_API_KEY no está configurada.\n"
                "\n"
                "Para configurarla:\n"
                "  1. Copia el archivo .env.example como .env\n"
                "  2. Reemplaza 'your-api-key-here' con tu clave de OpenAI\n"
                "\n"
                "Ejemplo:\n"
                "  cp .env.example .env\n"
                "  # Edita .env y agrega tu API key\n"
            )
            sys.exit(1)

    @property
    def chroma_persist_path(self) -> Path:
        """Ruta absoluta al directorio de persistencia de ChromaDB."""
        return (Path(__file__).resolve().parent / self.chroma_persist_dir).resolve()

    @property
    def documents_path(self) -> Path:
        """Ruta absoluta al directorio de documentos."""
        return (Path(__file__).resolve().parent / self.documents_dir).resolve()


# Instancia singleton — se importa como: from config import settings
settings = Settings()
