"""
Rutas de la API para la gestión de Áreas y Documentos de My Brain LM.

Implementa el CRUD de Áreas, listado de documentos por área, subida física e ingesta,
y eliminación física y semántica de documentos.
"""

import os
import shutil
import re
from pathlib import Path
from typing import List
import requests
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlmodel import Session, select, func
import chromadb

from config import settings
from api.database import get_session
from api.models import Area, Document, Conversation
from api.schemas import AreaCreate, AreaResponse, DocumentResponse, IngestFileResponse, URLIngestPayload, TextInputPayload
from ingest import ingest_file, SUPPORTED_EXTENSIONS
from retriever import bm25_cache_manager

router = APIRouter(prefix="/api/areas", tags=["Áreas"])

# Directorio base para almacenamiento físico
_storage_dir_env = os.getenv("STORAGE_DIR")
if _storage_dir_env:
    STORAGE_BASE_DIR = Path(_storage_dir_env)
else:
    STORAGE_BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent / "storage"


def get_area_storage_dir(area_id: str) -> Path:
    """Retorna la ruta física donde se guardan los documentos de un área."""
    path = STORAGE_BASE_DIR / f"area_{area_id}" / "documents"
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.post("", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
def create_area(payload: AreaCreate, session: Session = Depends(get_session)):
    """Crea una nueva Área funcional en el Cerebro."""
    # Verificar si ya existe un área con el mismo nombre
    stmt = select(Area).where(Area.name == payload.name)
    existing = session.exec(stmt).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe un área llamada '{payload.name}'."
        )

    db_area = Area(
        name=payload.name,
        description=payload.description,
        color=payload.color
    )
    session.add(db_area)
    session.commit()
    session.refresh(db_area)
    return db_area


@router.get("", response_model=List[AreaResponse])
def list_areas(session: Session = Depends(get_session)):
    """Lista todas las Áreas existentes con sus conteos de recursos."""
    areas = session.exec(select(Area)).all()
    response = []
    
    for area in areas:
        # Calcular dinámicamente conteos para la respuesta
        doc_count = len(area.documents)
        conv_count = len(area.conversations)
        
        area_res = AreaResponse(
            id=area.id,
            name=area.name,
            description=area.description,
            color=area.color,
            created_at=area.created_at,
            document_count=doc_count,
            conversation_count=conv_count
        )
        response.append(area_res)
        
    return response


@router.get("/{area_id}", response_model=AreaResponse)
def get_area(area_id: str, session: Session = Depends(get_session)):
    """Obtiene los detalles de un Área específica."""
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")
        
    return AreaResponse(
        id=area.id,
        name=area.name,
        description=area.description,
        color=area.color,
        created_at=area.created_at,
        document_count=len(area.documents),
        conversation_count=len(area.conversations)
    )


@router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(area_id: str, session: Session = Depends(get_session)):
    """Elimina un Área completa: SQLite, archivos del disco y ChromaDB."""
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    # 1. Eliminar colección de ChromaDB y su caché en memoria
    collection_name = f"mybrain_area_{area_id}"
    bm25_cache_manager.invalidate(collection_name)
    try:
        client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
        client.delete_collection(name=collection_name)
    except Exception:
        # Ignorar error si la colección no existe aún en Chroma
        pass

    # 2. Eliminar almacenamiento físico
    area_dir = STORAGE_BASE_DIR / f"area_{area_id}"
    if area_dir.exists():
        try:
            shutil.rmtree(area_dir)
        except Exception as e:
            # Registrar error, pero no detener la eliminación en DB
            print(f"Error al eliminar archivos físicos del área {area_id}: {e}")

    # 3. Eliminar de la SQLite (las relaciones se eliminan en cascada gracias a cascade-orphan)
    session.delete(area)
    session.commit()
    return


# =====================================================================
# Gestión de Documentos dentro de Áreas
# =====================================================================

@router.post("/{area_id}/ingest/file", response_model=IngestFileResponse)
async def ingest_file_to_area(
    area_id: str,
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """Sube un archivo a un área específica, lo persiste e ingesta en ChromaDB."""
    # Verificar que el área existe
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    # Validar extensión
    if not file.filename:
        raise HTTPException(status_code=400, detail="El archivo no tiene nombre.")
        
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado: '{suffix}'. Válidos: {', '.join(SUPPORTED_EXTENSIONS)}",
        )

    content = await file.read()
    
    # Validar tamaño (máximo 10MB)
    max_size = 10 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"El archivo excede el límite de 10MB ({len(content) / 1024 / 1024:.1f}MB).",
        )

    # Persistir archivo físicamente
    storage_dir = get_area_storage_dir(area_id)
    dest_path = storage_dir / file.filename

    try:
        with open(dest_path, "wb") as f:
            f.write(content)

        # Ingestar en ChromaDB bajo la colección del área
        collection_name = f"mybrain_area_{area_id}"
        chunks_count = ingest_file(str(dest_path), collection_name=collection_name)

        # Invalidad la caché del índice BM25 en memoria
        bm25_cache_manager.invalidate(collection_name)

        # Guardar registro en la SQLite
        # Si ya existe en DB, actualizar metadatos o recrearlo
        stmt = select(Document).where(Document.filename == file.filename, Document.area_id == area_id)
        existing_doc = session.exec(stmt).first()
        
        if existing_doc:
            existing_doc.file_size = len(content)
            existing_doc.file_path = str(dest_path)
            session.add(existing_doc)
        else:
            db_doc = Document(
                filename=file.filename,
                file_path=str(dest_path),
                file_size=len(content),
                area_id=area_id
            )
            session.add(db_doc)
            
        session.commit()

        return IngestFileResponse(
            filename=file.filename,
            chunks=chunks_count,
            message=f"Archivo '{file.filename}' guardado e ingestado exitosamente ({chunks_count} chunks)."
        )
        
    except Exception as e:
        # Limpiar archivo físico si falló
        if dest_path.exists():
            os.remove(dest_path)
        raise HTTPException(
            status_code=500,
            detail=f"Error en la ingesta: {str(e)}"
        )



@router.post("/{area_id}/ingest/url", response_model=IngestFileResponse)
async def ingest_url_to_area(
    area_id: str,
    payload: URLIngestPayload,
    session: Session = Depends(get_session)
):
    """Descarga el contenido de una URL vía Jina Reader API, lo guarda como archivo MD e ingesta."""
    # 1. Verificar que el área existe
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    url = payload.url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(
            status_code=400,
            detail="La URL debe comenzar con http:// o https://"
        )

    # 2. Consultar Jina Reader API
    # Determinar si es un link de Medium para intentar el bypass con Freedium
    is_medium = False
    medium_domains = ["medium.com", "towardsdatascience.com", "uxdesign.cc", "betterprogramming.pub", "betterhumans.coach", "writingcoop.com", "javascriptinplainenglish.com", "python.plainenglish.io"]
    for domain in medium_domains:
        if domain in url:
            is_medium = True
            break

    resp_json = None
    if is_medium:
        try:
            freedium_url = f"https://freedium.cfd/{url}"
            jina_reader_url = f"https://r.jina.ai/{freedium_url}"
            headers = {"Accept": "application/json"}
            jina_key = getattr(settings, "jina_api_key", None) or os.getenv("JINA_API_KEY", "")
            if jina_key:
                headers["Authorization"] = f"Bearer {jina_key}"
            response = requests.get(jina_reader_url, headers=headers, timeout=30)
            response.raise_for_status()
            resp_json = response.json()
        except Exception as e:
            print(f"Error al usar Freedium bypass para Medium, reintentando directo: {e}")

    if not resp_json:
        jina_reader_url = f"https://r.jina.ai/{url}"
        headers = {"Accept": "application/json"}
        jina_key = getattr(settings, "jina_api_key", None) or os.getenv("JINA_API_KEY", "")
        if jina_key:
            headers["Authorization"] = f"Bearer {jina_key}"
        try:
            response = requests.get(jina_reader_url, headers=headers, timeout=30)
            response.raise_for_status()
            resp_json = response.json()
        except Exception as e:
            raise HTTPException(
                status_code=502,
                detail=f"Error al conectar con el servicio Jina Reader: {str(e)}"
            )

    # Validar formato de respuesta
    if not resp_json or "data" not in resp_json:
        raise HTTPException(
            status_code=502,
            detail="El servicio Jina Reader retornó una respuesta inválida."
        )

    data = resp_json["data"]
    title = data.get("title") or ""
    content = data.get("content") or ""

    if not content.strip():
        raise HTTPException(
            status_code=400,
            detail="La URL especificada no contiene texto legible indexable."
        )

    # Si no hay título, usar dominio o nombre genérico
    if not title.strip():
        from urllib.parse import urlparse
        parsed = urlparse(url)
        title = parsed.netloc or "enlace_web"

    # 3. Sanitizar título para el nombre de archivo
    # Reemplazar caracteres no permitidos por guión bajo
    sanitized_title = re.sub(r'[\\/*?:"<>|]', "_", title)
    # Limitar longitud para evitar problemas con el sistema de archivos
    if len(sanitized_title) > 100:
        sanitized_title = sanitized_title[:100].strip()
    
    filename = f"{sanitized_title}.md"

    # 4. Guardar físicamente el contenido Markdown en la carpeta de documentos de la área
    storage_dir = get_area_storage_dir(area_id)
    dest_path = storage_dir / filename

    content_bytes = content.encode("utf-8")

    # Validar tamaño (máximo 10MB)
    max_size = 10 * 1024 * 1024
    if len(content_bytes) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"El contenido de la página excede el límite de 10MB ({len(content_bytes) / 1024 / 1024:.1f}MB).",
        )

    try:
        with open(dest_path, "wb") as f:
            f.write(content_bytes)

        # Ingestar en ChromaDB bajo la colección del área
        collection_name = f"mybrain_area_{area_id}"
        chunks_count = ingest_file(str(dest_path), collection_name=collection_name)

        # Invalidad la caché del índice BM25
        bm25_cache_manager.invalidate(collection_name)

        # Guardar registro en la SQLite
        stmt = select(Document).where(Document.filename == filename, Document.area_id == area_id)
        existing_doc = session.exec(stmt).first()
        
        if existing_doc:
            existing_doc.file_size = len(content_bytes)
            existing_doc.file_path = str(dest_path)
            session.add(existing_doc)
        else:
            db_doc = Document(
                filename=filename,
                file_path=str(dest_path),
                file_size=len(content_bytes),
                area_id=area_id
            )
            session.add(db_doc)
            
        session.commit()

        return IngestFileResponse(
            filename=filename,
            chunks=chunks_count,
            message=f"Enlace '{title}' guardado como '{filename}' e ingestado exitosamente ({chunks_count} chunks)."
        )

    except Exception as e:
        if dest_path.exists():
            os.remove(dest_path)
        raise HTTPException(
            status_code=500,
            detail=f"Error en la ingesta del enlace: {str(e)}"
        )


@router.post("/{area_id}/ingest/text", response_model=IngestFileResponse)
async def ingest_text_to_area(
    area_id: str,
    payload: TextInputPayload,
    session: Session = Depends(get_session)
):
    """Guarda un texto copiado como archivo MD e ingesta en ChromaDB."""
    # 1. Verificar que el área existe
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    title = payload.title.strip()
    content = payload.content

    if not title:
        raise HTTPException(status_code=400, detail="El título es requerido.")
    if not content.strip():
        raise HTTPException(status_code=400, detail="El contenido no puede estar vacío.")

    # 2. Sanitizar título para el nombre de archivo
    sanitized_title = re.sub(r'[\\/*?:"<>|]', "_", title)
    if len(sanitized_title) > 100:
        sanitized_title = sanitized_title[:100].strip()
    
    filename = f"{sanitized_title}.md"

    # 3. Guardar físicamente el contenido Markdown en la carpeta de documentos del área
    storage_dir = get_area_storage_dir(area_id)
    dest_path = storage_dir / filename

    content_bytes = content.encode("utf-8")

    # Validar tamaño (máximo 10MB)
    max_size = 10 * 1024 * 1024
    if len(content_bytes) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"El contenido excede el límite de 10MB ({len(content_bytes) / 1024 / 1024:.1f}MB).",
        )

    try:
        with open(dest_path, "wb") as f:
            f.write(content_bytes)

        # Ingestar en ChromaDB bajo la colección del área
        collection_name = f"mybrain_area_{area_id}"
        chunks_count = ingest_file(str(dest_path), collection_name=collection_name)

        # Invalidad la caché del índice BM25
        bm25_cache_manager.invalidate(collection_name)

        # Guardar registro en la SQLite
        stmt = select(Document).where(Document.filename == filename, Document.area_id == area_id)
        existing_doc = session.exec(stmt).first()
        
        if existing_doc:
            existing_doc.file_size = len(content_bytes)
            existing_doc.file_path = str(dest_path)
            session.add(existing_doc)
        else:
            db_doc = Document(
                filename=filename,
                file_path=str(dest_path),
                file_size=len(content_bytes),
                area_id=area_id
            )
            session.add(db_doc)
            
        session.commit()

        return IngestFileResponse(
            filename=filename,
            chunks=chunks_count,
            message=f"Texto '{title}' guardado como '{filename}' e ingestado exitosamente ({chunks_count} chunks)."
        )

    except Exception as e:
        if dest_path.exists():
            os.remove(dest_path)
        raise HTTPException(
            status_code=500,
            detail=f"Error en la ingesta del texto: {str(e)}"
        )


@router.get("/{area_id}/documents", response_model=List[DocumentResponse])
def list_area_documents(area_id: str, session: Session = Depends(get_session)):
    """Lista todos los documentos cargados en un Área específica."""
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada.")

    return area.documents


@router.delete("/{area_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area_document(
    area_id: str,
    document_id: int,
    session: Session = Depends(get_session)
):
    """Elimina un documento: de SQLite, del almacenamiento físico y de ChromaDB."""
    doc = session.get(Document, document_id)
    if not doc or doc.area_id != area_id:
        raise HTTPException(
            status_code=404,
            detail="Documento no encontrado en esta área."
        )

    # 1. Eliminar de ChromaDB (eliminar todos los chunks de este archivo) e invalidar la caché
    collection_name = f"mybrain_area_{area_id}"
    bm25_cache_manager.invalidate(collection_name)
    try:
        client = chromadb.PersistentClient(path=str(settings.chroma_persist_path))
        collection = client.get_collection(name=collection_name)
        # Chroma permite borrar filtrando por metadatos (upsert guardó "source" en metadatos)
        collection.delete(where={"source": doc.filename})
    except Exception as e:
        print(f"Error al eliminar chunks de ChromaDB para {doc.filename}: {e}")

    # 2. Eliminar del disco físico
    phys_path = Path(doc.file_path)
    if phys_path.exists():
        try:
            os.remove(phys_path)
        except Exception as e:
            print(f"Error al eliminar archivo físico {phys_path}: {e}")

    # 3. Eliminar de la SQLite
    session.delete(doc)
    session.commit()
    return
