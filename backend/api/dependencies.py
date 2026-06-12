"""
Dependencias compartidas para la API REST de MyBrain.

Centraliza la inicialización de clientes y recursos que se
reutilizan en múltiples endpoints.
"""

from openai import OpenAI
from config import settings


def get_openai_client() -> OpenAI:
    """Retorna un cliente de OpenAI configurado.
    
    Por ahora crea una instancia nueva cada vez.
    En el futuro se puede convertir en un singleton o pool.
    """
    return OpenAI(api_key=settings.openai_api_key)
