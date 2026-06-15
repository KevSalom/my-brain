"""
Configuración de la base de datos relacional (SQLite) para My Brain LM.

Configura el motor de SQLModel, la creación de tablas y la provisión de sesiones.
"""

from pathlib import Path
from typing import Generator
from sqlmodel import create_engine, SQLModel, Session

# Definir la ruta de la base de datos en el directorio backend
BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_FILE = BACKEND_DIR / "mybrain.db"
DATABASE_URL = f"sqlite:///{DB_FILE}"

# Configurar el motor de la base de datos (con check_same_thread=False para FastAPI async)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False  # Cambiar a True para debuguear SQL si es necesario
)


def create_db_and_tables() -> None:
    """Crea la base de datos SQLite y todas las tablas definidas en los modelos."""
    # Importar los modelos aquí para asegurar que se registren en la metadata
    from api import models
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """Provee una sesión de base de datos para inyección de dependencias en FastAPI.

    Asegura que la sesión se cierre correctamente tras completar la consulta.
    """
    with Session(engine) as session:
        yield session
