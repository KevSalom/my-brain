"""
Módulo de ingestión de documentos de My Brain LM.

Se encarga de:
- Leer archivos .txt y .pdf
- Dividirlos en chunks usando la estrategia configurada (basic/smart)
- Generar embeddings con la API de OpenAI
- Almacenarlos en ChromaDB con metadatos enriquecidos
"""

import os
import hashlib
from pathlib import Path
from typing import Optional

import chromadb
from openai import OpenAI
from pypdf import PdfReader
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.panel import Panel
from rich.table import Table

from config import settings
from chunking import get_chunking_strategy, ChunkResult

# Consola de rich para salida formateada
console = Console()

# Extensiones de archivo soportadas
SUPPORTED_EXTENSIONS = {".txt", ".pdf", ".md"}


def _get_openai_client() -> OpenAI:
    """Crea y retorna un cliente de OpenAI configurado."""
    return OpenAI(api_key=settings.openai_api_key)


def _get_chroma_collection(collection_name: Optional[str] = None) -> chromadb.Collection:
    """Crea o recupera la colección de ChromaDB específica o por defecto.

    Utiliza persistencia en disco para mantener los datos entre ejecuciones.
    """
    client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
    name = collection_name or settings.collection_name
    collection = client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},  # Usar distancia coseno
    )
    return collection


def _read_txt_file(file_path: Path) -> str:
    """Lee el contenido de un archivo de texto plano.

    Args:
        file_path: Ruta al archivo .txt

    Returns:
        Contenido del archivo como cadena de texto.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def _read_pdf_file(file_path: Path) -> str:
    """Lee el contenido de un archivo PDF usando pypdf.

    Extrae el texto de todas las páginas y las concatena.

    Args:
        file_path: Ruta al archivo .pdf

    Returns:
        Texto extraído del PDF completo.
    """
    reader = PdfReader(str(file_path))
    pages_text: list[str] = []

    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages_text.append(text)

    return "\n\n".join(pages_text)


def _read_file(file_path: Path) -> str:
    """Lee un archivo según su extensión.

    Args:
        file_path: Ruta al archivo a leer.

    Returns:
        Contenido del archivo como texto.

    Raises:
        ValueError: Si la extensión del archivo no está soportada.
        FileNotFoundError: Si el archivo no existe.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"El archivo no existe: {file_path}")

    suffix = file_path.suffix.lower()

    if suffix == ".txt" or suffix == ".md":
        return _read_txt_file(file_path)
    elif suffix == ".pdf":
        return _read_pdf_file(file_path)
    else:
        raise ValueError(
            f"Formato no soportado: '{suffix}'. "
            f"Formatos válidos: {', '.join(SUPPORTED_EXTENSIONS)}"
        )


def _chunk_text(text: str, file_type: str = "txt") -> list[ChunkResult]:
    """Divide el texto en chunks usando la estrategia configurada.

    La estrategia se selecciona desde settings.chunking_strategy:
    - 'basic': separadores genéricos (párrafos, líneas, oraciones)
    - 'smart': separadores conscientes de código + metadata enriquecida

    Args:
        text: Texto completo a dividir.
        file_type: Tipo de archivo ('txt', 'pdf', 'md') para que la
                   estrategia smart pueda extraer headings de Markdown.

    Returns:
        Lista de ChunkResult con texto y metadata por chunk.
    """
    strategy = get_chunking_strategy()
    return strategy.chunk(text, file_type=file_type)


def _generate_embeddings(texts: list[str], client: OpenAI) -> list[list[float]]:
    """Genera embeddings para una lista de textos usando la API de OpenAI.

    Args:
        texts: Lista de cadenas de texto para generar embeddings.
        client: Cliente de OpenAI configurado.

    Returns:
        Lista de vectores de embedding.
    """
    response = client.embeddings.create(
        input=texts,
        model=settings.embedding_model,
    )
    # Ordenar por índice para mantener el orden correcto
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]


def _generate_chunk_id(source: str, chunk_index: int) -> str:
    """Genera un ID único y determinista para cada chunk.

    Utiliza un hash del nombre del archivo fuente y el índice del chunk
    para que re-ingestar el mismo archivo reemplace los chunks anteriores.

    Args:
        source: Nombre del archivo fuente.
        chunk_index: Índice del chunk dentro del documento.

    Returns:
        ID único para el chunk.
    """
    content = f"{source}::chunk_{chunk_index}"
    return hashlib.md5(content.encode()).hexdigest()


def ingest_file(file_path: str, collection_name: Optional[str] = None) -> int:
    """Ingesta un solo archivo en ChromaDB.

    Lee el archivo, lo divide en chunks, genera embeddings y los almacena
    en la colección de ChromaDB con metadatos.

    Args:
        file_path: Ruta al archivo a ingestar.
        collection_name: Nombre de la colección de ChromaDB donde guardar los chunks.

    Returns:
        Número de chunks ingestados.
    """
    path = Path(file_path).resolve()
    source_name = path.name
    file_type = path.suffix.lower().lstrip(".")

    # Obtener la estrategia de chunking activa
    strategy = get_chunking_strategy()
    console.print(
        f"\n📄 Procesando: [bold cyan]{source_name}[/bold cyan] "
        f"[dim](chunking: {strategy.name})[/dim]"
    )

    # Paso 1: Leer el archivo
    with console.status("[bold green]Leyendo archivo..."):
        text = _read_file(path)

    if not text.strip():
        console.print(f"  ⚠️  El archivo [yellow]{source_name}[/yellow] está vacío. Omitiendo.")
        return 0

    console.print(f"  ✅ Leído: {len(text):,} caracteres")

    # Paso 2: Dividir en chunks (usa la estrategia configurada)
    with console.status("[bold green]Dividiendo en chunks..."):
        chunk_results = _chunk_text(text, file_type=file_type)

    # Extraer los textos para embedding y almacenamiento
    chunk_texts = [cr.text for cr in chunk_results]

    console.print(f"  ✅ Chunks generados: {len(chunk_texts)}")

    # Paso 3: Generar embeddings
    openai_client = _get_openai_client()

    with console.status("[bold green]Generando embeddings con OpenAI..."):
        embeddings = _generate_embeddings(chunk_texts, openai_client)

    console.print(f"  ✅ Embeddings generados: {len(embeddings)}")

    # Paso 4: Preparar metadatos e IDs
    # Combinar metadata base del archivo con metadata enriquecida de cada chunk
    ids = [_generate_chunk_id(source_name, i) for i in range(len(chunk_results))]
    metadatas = []
    for i, cr in enumerate(chunk_results):
        # Metadata base (siempre presente)
        meta = {
            "source": source_name,
            "chunk_index": i,
            "file_type": file_type,
            "total_chunks": len(chunk_results),
        }
        # Fusionar metadata enriquecida del chunking strategy (section_heading,
        # has_code, code_languages, chunking_strategy, etc.)
        meta.update(cr.metadata)
        metadatas.append(meta)

    # Paso 5: Almacenar en ChromaDB (upsert para permitir re-ingestión)
    with console.status("[bold green]Almacenando en ChromaDB..."):
        collection = _get_chroma_collection(collection_name)
        collection.upsert(
            ids=ids,
            documents=chunk_texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

    console.print(f"  ✅ Almacenado en colección '[bold]{collection.name}[/bold]'")

    # Mostrar resumen de metadata enriquecida si estamos usando smart chunking
    if strategy.name == "smart":
        _print_smart_chunking_summary(chunk_results)

    return len(chunk_texts)


def ingest_directory(
    dir_path: Optional[str] = None,
    collection_name: Optional[str] = None
) -> dict[str, int]:
    """Ingesta todos los archivos soportados de un directorio.

    Recorre el directorio buscando archivos .txt y .pdf, y los ingesta
    uno por uno, mostrando el progreso.

    Args:
        dir_path: Ruta al directorio a procesar. Si es None, usa el
                  directorio de documentos configurado.
        collection_name: Nombre de la colección ChromaDB de destino.

    Returns:
        Diccionario con {nombre_archivo: número_de_chunks} para cada
        archivo procesado exitosamente.
    """
    directory = Path(dir_path).resolve() if dir_path else settings.documents_path

    if not directory.exists():
        console.print(f"\n❌ El directorio no existe: [red]{directory}[/red]")
        return {}

    if not directory.is_dir():
        console.print(f"\n❌ La ruta no es un directorio: [red]{directory}[/red]")
        return {}

    # Buscar archivos soportados
    files = [
        f for f in sorted(directory.iterdir())
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not files:
        console.print(
            f"\n⚠️  No se encontraron archivos soportados en: [yellow]{directory}[/yellow]"
        )
        console.print(
            f"   Formatos válidos: {', '.join(SUPPORTED_EXTENSIONS)}"
        )
        return {}

    console.print(
        Panel(
            f"📂 Directorio: [bold]{directory}[/bold]\n"
            f"📄 Archivos encontrados: [bold cyan]{len(files)}[/bold cyan]",
            title="[bold blue]Ingestión de Documentos[/bold blue]",
            border_style="blue",
        )
    )

    results: dict[str, int] = {}
    total_chunks = 0

    for file_path in files:
        try:
            chunks = ingest_file(str(file_path), collection_name=collection_name)
            results[file_path.name] = chunks
            total_chunks += chunks
        except Exception as e:
            console.print(f"\n  ❌ Error procesando [red]{file_path.name}[/red]: {e}")
            results[file_path.name] = 0

    # Resumen final
    _print_ingest_summary(results, total_chunks)

    return results


def _print_smart_chunking_summary(chunk_results: list[ChunkResult]) -> None:
    """Muestra un resumen de la metadata enriquecida generada por smart chunking.

    Incluye: secciones detectadas, chunks con código, y lenguajes encontrados.

    Args:
        chunk_results: Lista de ChunkResult con metadata enriquecida.
    """
    sections: set[str] = set()
    chunks_with_code = 0
    languages: set[str] = set()

    for cr in chunk_results:
        heading = cr.metadata.get("section_heading")
        if heading:
            sections.add(heading)
        if cr.metadata.get("has_code"):
            chunks_with_code += 1
        langs = cr.metadata.get("code_languages", "")
        if langs:
            for lang in langs.split(", "):
                languages.add(lang)

    # Mostrar resumen compacto
    summary_parts = []
    if sections:
        summary_parts.append(f"📑 Secciones: {len(sections)}")
    summary_parts.append(f"💻 Chunks con código: {chunks_with_code}/{len(chunk_results)}")
    if languages:
        summary_parts.append(f"🔤 Lenguajes: {', '.join(sorted(languages))}")

    console.print(f"  [dim]{'  |  '.join(summary_parts)}[/dim]")


def _print_ingest_summary(results: dict[str, int], total_chunks: int) -> None:
    """Muestra una tabla resumen de la ingestión.

    Args:
        results: Diccionario con resultados por archivo.
        total_chunks: Total de chunks ingestados.
    """
    table = Table(
        title="\n📊 Resumen de Ingestión",
        show_header=True,
        header_style="bold magenta",
    )
    table.add_column("Archivo", style="cyan")
    table.add_column("Chunks", justify="right", style="green")
    table.add_column("Estado", justify="center")

    for filename, chunks in results.items():
        status = "✅" if chunks > 0 else "❌"
        table.add_row(filename, str(chunks), status)

    table.add_section()
    table.add_row("[bold]Total[/bold]", f"[bold]{total_chunks}[/bold]", "")

    console.print(table)
