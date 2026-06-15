"""
Módulo de estrategias de chunking para My Brain LM.

Proporciona dos estrategias intercambiables:
- BasicChunking: Chunking genérico con separadores básicos (el original)
- SmartChunking: Chunking inteligente optimizado para documentación técnica
  - Separadores conscientes de código (class, def, ##, etc.)
  - Extracción automática de headings de Markdown como metadata
  - Detección de bloques de código en cada chunk
  - Chunk size adaptativo (más grande para contenido con código)

Ambas implementan la misma interfaz ChunkingStrategy para poder
intercambiarlas fácilmente desde la configuración.
"""

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import settings


# ---------------------------------------------------------------------------
# Dataclass para representar un chunk con su metadata enriquecida
# ---------------------------------------------------------------------------

@dataclass
class ChunkResult:
    """Resultado de dividir un documento en chunks.

    Cada ChunkResult contiene el texto del chunk junto con metadata
    enriquecida que mejora el retrieval posterior.

    Attributes:
        text: Contenido textual del chunk.
        metadata: Diccionario con metadata adicional del chunk.
    """

    text: str
    metadata: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Interfaz base — ambas estrategias implementan esto
# ---------------------------------------------------------------------------

class ChunkingStrategy(ABC):
    """Interfaz base para estrategias de chunking.

    Todas las estrategias de chunking deben implementar esta interfaz
    para poder intercambiarse de forma transparente.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Nombre identificador de la estrategia."""
        ...

    @abstractmethod
    def chunk(self, text: str, file_type: str = "txt") -> list[ChunkResult]:
        """Divide un texto en chunks con metadata.

        Args:
            text: Texto completo del documento.
            file_type: Tipo de archivo ('txt', 'pdf', 'md').

        Returns:
            Lista de ChunkResult con texto y metadata por chunk.
        """
        ...


# ---------------------------------------------------------------------------
# Estrategia 1: Chunking Básico (el original)
# ---------------------------------------------------------------------------

class BasicChunking(ChunkingStrategy):
    """Chunking genérico con separadores básicos.

    Usa los separadores por defecto: doble salto de línea, salto de línea,
    punto+espacio, espacio, vacío. Es el chunking original del PoC.

    Adecuado para texto general sin estructura particular.
    """

    @property
    def name(self) -> str:
        return "basic"

    def chunk(self, text: str, file_type: str = "txt") -> list[ChunkResult]:
        """Divide el texto con separadores genéricos.

        Args:
            text: Texto completo del documento.
            file_type: Tipo de archivo (no afecta el comportamiento en basic).

        Returns:
            Lista de ChunkResult con metadata mínima.
        """
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

        chunks = splitter.split_text(text)

        return [
            ChunkResult(
                text=chunk_text,
                metadata={"chunking_strategy": self.name},
            )
            for chunk_text in chunks
        ]


# ---------------------------------------------------------------------------
# Estrategia 2: Chunking Inteligente para Documentación Técnica
# ---------------------------------------------------------------------------

# Separadores ordenados de mayor a menor prioridad de corte.
# Los primeros son los puntos de corte "ideales" (entre secciones),
# los últimos son los de emergencia (partir palabras).
_SMART_SEPARATORS = [
    # --- Límites de sección Markdown (máxima prioridad) ---
    "\n## ",         # Heading nivel 2 (sección principal)
    "\n### ",        # Heading nivel 3 (subsección)
    "\n#### ",       # Heading nivel 4
    # --- Límites de código (alta prioridad) ---
    "\n```\n",       # Cierre/apertura de bloque de código
    "\nclass ",      # Definición de clase (Python, JS, TS, Java...)
    "\ndef ",        # Definición de función Python
    "\nasync def ",  # Función async Python
    "\nfunction ",   # Función JavaScript
    "\nexport ",     # Export (JS/TS)
    # --- Límites de párrafo (prioridad media) ---
    "\n\n",          # Doble salto de línea (párrafo)
    "\n",            # Salto de línea simple
    # --- Límites de oración y palabra (baja prioridad) ---
    ". ",            # Fin de oración
    " ",             # Espacio (partir entre palabras)
    "",              # Último recurso (partir en cualquier punto)
]

# Regex para detectar bloques de código fenced (```...```)
_CODE_BLOCK_PATTERN = re.compile(r"```[\s\S]*?```", re.MULTILINE)

# Regex para detectar headings Markdown (# ... ## ... ### ...)
_HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


class SmartChunking(ChunkingStrategy):
    """Chunking inteligente optimizado para documentación técnica.

    Mejoras respecto al chunking básico:

    1. **Separadores conscientes de código**: Prioriza cortar entre clases,
       funciones, secciones Markdown y bloques de código, evitando partir
       una función o clase a la mitad.

    2. **Chunk size adaptativo**: Usa un tamaño de chunk 50% mayor
       (configurable) para dar más contexto, especialmente útil cuando
       el chunk contiene código que necesita verse completo.

    3. **Extracción de heading de sección**: Para archivos Markdown, detecta
       bajo qué heading (##, ###) cae cada chunk y lo guarda como metadata.
       Esto permite al retriever saber "este chunk pertenece a la sección
       useCallback" sin depender solo del embedding.

    4. **Detección de código**: Marca cada chunk con `has_code: True/False`
       para que el retriever pueda priorizar chunks con código cuando
       la pregunta parece ser sobre implementación.

    5. **Extracción de lenguaje**: Si hay bloques de código fenced con
       indicador de lenguaje (```python, ```javascript), lo extrae
       como metadata.
    """

    # Factor por el cual se aumenta el chunk_size para documentación técnica.
    # 1.5 = 50% más grande (ej: 1000 → 1500 chars)
    CHUNK_SIZE_FACTOR = 1.5

    # Factor de overlap relativo al chunk_size efectivo
    OVERLAP_RATIO = 0.15

    @property
    def name(self) -> str:
        return "smart"

    def chunk(self, text: str, file_type: str = "txt") -> list[ChunkResult]:
        """Divide el texto con separadores conscientes de código y metadata enriquecida.

        Args:
            text: Texto completo del documento.
            file_type: Tipo de archivo ('txt', 'pdf', 'md').

        Returns:
            Lista de ChunkResult con metadata enriquecida por chunk.
        """
        # Chunk size adaptativo: más grande para dar más contexto al código
        effective_chunk_size = int(settings.chunk_size * self.CHUNK_SIZE_FACTOR)
        effective_overlap = int(effective_chunk_size * self.OVERLAP_RATIO)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=effective_chunk_size,
            chunk_overlap=effective_overlap,
            length_function=len,
            separators=_SMART_SEPARATORS,
        )

        raw_chunks = splitter.split_text(text)

        # Pre-construir el mapa de headings si es Markdown o txt con estructura MD
        heading_map = self._build_heading_map(text) if file_type in ("md", "txt") else []

        results: list[ChunkResult] = []
        for chunk_text in raw_chunks:
            metadata = self._enrich_metadata(chunk_text, text, file_type, heading_map)
            results.append(ChunkResult(text=chunk_text, metadata=metadata))

        return results

    def _enrich_metadata(
        self,
        chunk_text: str,
        full_text: str,
        file_type: str,
        heading_map: list[tuple[int, str]],
    ) -> dict:
        """Genera metadata enriquecida para un chunk individual.

        Args:
            chunk_text: Texto del chunk.
            full_text: Texto completo del documento (para ubicar el chunk).
            file_type: Tipo de archivo.
            heading_map: Lista de (posición, heading) extraídos del documento.

        Returns:
            Diccionario con metadata enriquecida.
        """
        metadata: dict = {
            "chunking_strategy": self.name,
        }

        # --- Detección de bloques de código ---
        has_code = bool(_CODE_BLOCK_PATTERN.search(chunk_text))
        metadata["has_code"] = has_code

        # --- Extracción de lenguaje de código ---
        if has_code:
            languages = self._extract_code_languages(chunk_text)
            if languages:
                metadata["code_languages"] = ", ".join(languages)

        # --- Extracción de heading de sección ---
        if heading_map:
            section = self._find_section_heading(chunk_text, full_text, heading_map)
            if section:
                metadata["section_heading"] = section

        return metadata

    @staticmethod
    def _build_heading_map(text: str) -> list[tuple[int, str]]:
        """Construye un mapa de posiciones de headings en el documento.

        Recorre el texto buscando headings Markdown (# Titulo, ## Sección, etc.)
        y registra su posición y texto. Este mapa se usa luego para determinar
        bajo qué sección cae cada chunk.

        Args:
            text: Texto completo del documento.

        Returns:
            Lista de tuplas (posición_en_texto, texto_del_heading) ordenadas
            por posición.
        """
        headings: list[tuple[int, str]] = []
        for match in _HEADING_PATTERN.finditer(text):
            headings.append((match.start(), match.group(2).strip()))
        return headings

    @staticmethod
    def _find_section_heading(
        chunk_text: str,
        full_text: str,
        heading_map: list[tuple[int, str]],
    ) -> Optional[str]:
        """Encuentra el heading de sección al que pertenece un chunk.

        Busca la posición del chunk en el texto completo y luego encuentra
        el heading más cercano que aparece ANTES de esa posición.

        Args:
            chunk_text: Texto del chunk.
            full_text: Texto completo del documento.
            heading_map: Mapa de headings pre-construido.

        Returns:
            Texto del heading de sección, o None si no se encuentra.
        """
        if not heading_map:
            return None

        # Buscar la posición del chunk en el texto completo
        # Usamos los primeros 100 chars para evitar falsos positivos con chunks
        # muy cortos o repetitivos
        search_snippet = chunk_text[:100]
        chunk_pos = full_text.find(search_snippet)

        if chunk_pos == -1:
            return None

        # Encontrar el heading más cercano ANTES de la posición del chunk
        best_heading: Optional[str] = None
        for pos, heading_text in heading_map:
            if pos <= chunk_pos:
                best_heading = heading_text
            else:
                break  # Ya pasamos la posición del chunk

        return best_heading

    @staticmethod
    def _extract_code_languages(chunk_text: str) -> list[str]:
        """Extrae los lenguajes de los bloques de código fenced.

        Busca patrones como ```python, ```javascript, ```typescript, etc.
        y devuelve la lista de lenguajes únicos encontrados.

        Args:
            chunk_text: Texto del chunk.

        Returns:
            Lista de nombres de lenguajes únicos encontrados.
        """
        # Buscar ```<lenguaje> al inicio de bloques de código
        lang_pattern = re.compile(r"```(\w+)")
        matches = lang_pattern.findall(chunk_text)

        # Filtrar lenguajes válidos (no vacíos) y devolver únicos preservando orden
        seen: set[str] = set()
        languages: list[str] = []
        for lang in matches:
            lang_lower = lang.lower()
            if lang_lower not in seen:
                seen.add(lang_lower)
                languages.append(lang_lower)

        return languages


# ---------------------------------------------------------------------------
# Factory — obtiene la estrategia según la configuración
# ---------------------------------------------------------------------------

# Registro de estrategias disponibles
_STRATEGIES: dict[str, type[ChunkingStrategy]] = {
    "basic": BasicChunking,
    "smart": SmartChunking,
}


def get_chunking_strategy(strategy_name: Optional[str] = None) -> ChunkingStrategy:
    """Obtiene una instancia de la estrategia de chunking solicitada.

    Si no se especifica nombre, usa la configurada en settings.

    Args:
        strategy_name: Nombre de la estrategia ('basic' o 'smart').
                       Si es None, usa settings.chunking_strategy.

    Returns:
        Instancia de la estrategia de chunking.

    Raises:
        ValueError: Si el nombre de estrategia no es válido.
    """
    name = strategy_name or settings.chunking_strategy

    if name not in _STRATEGIES:
        valid = ", ".join(f"'{k}'" for k in _STRATEGIES)
        raise ValueError(
            f"Estrategia de chunking '{name}' no válida. "
            f"Opciones disponibles: {valid}"
        )

    return _STRATEGIES[name]()
