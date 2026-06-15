"""
Endpoints de ingesta de documentos de My Brain LM.

POST /api/ingest/file      — Sube e ingesta un archivo individual.
POST /api/ingest/directory  — Ingesta todos los archivos del directorio configurado.
"""

import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from config import settings
from ingest import ingest_file, ingest_directory, SUPPORTED_EXTENSIONS
from api.schemas import IngestFileResponse, IngestDirectoryResponse

router = APIRouter(prefix="/api/ingest", tags=["Ingesta"])

# Directorio temporal para archivos subidos via API
_UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"


@router.post(
    "/file",
    response_model=IngestFileResponse,
    summary="Ingestar un archivo",
    description="Sube un archivo (TXT, PDF, MD) y lo ingesta en ChromaDB.",
)
async def ingest_uploaded_file(file: UploadFile = File(...)):
    """Recibe un archivo, lo guarda temporalmente e ingesta su contenido."""
    
    # Validar extensión
    if not file.filename:
        raise HTTPException(status_code=400, detail="El archivo no tiene nombre.")
    
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado: '{suffix}'. Formatos válidos: {', '.join(SUPPORTED_EXTENSIONS)}",
        )
    
    # Validar tamaño (máximo 10MB)
    max_size = 10 * 1024 * 1024  # 10MB
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"El archivo excede el tamaño máximo de 10MB ({len(content) / 1024 / 1024:.1f}MB).",
        )
    
    # Guardar temporalmente
    _UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    temp_path = _UPLOADS_DIR / file.filename
    
    try:
        with open(temp_path, "wb") as f:
            f.write(content)
        
        # Ingestar usando la función existente
        chunks = ingest_file(str(temp_path))
        
        return IngestFileResponse(
            filename=file.filename,
            chunks=chunks,
            message=f"Archivo '{file.filename}' ingestado exitosamente con {chunks} chunks.",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al ingestar: {str(e)}")
    finally:
        # Limpiar archivo temporal
        if temp_path.exists():
            os.remove(temp_path)


@router.post(
    "/directory",
    response_model=IngestDirectoryResponse,
    summary="Ingestar directorio de documentos",
    description="Ingesta todos los archivos soportados del directorio de documentos configurado.",
)
async def ingest_documents_directory():
    """Ingesta todos los archivos del directorio de documentos configurado."""
    
    docs_dir = settings.documents_path
    
    if not docs_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"El directorio de documentos no existe: {docs_dir}",
        )
    
    try:
        results = ingest_directory(str(docs_dir))
        total = sum(results.values())
        
        return IngestDirectoryResponse(
            directory=str(docs_dir),
            files_processed=len(results),
            total_chunks=total,
            results=results,
            message=f"Ingestión completada: {total} chunks desde {len(results)} archivo(s).",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en la ingesta: {str(e)}")
