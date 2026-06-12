import type { StatusResponse, IngestFileResponse, IngestDirectoryResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function getStatus(): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/status`);
  if (!response.ok) {
    throw new Error(`Error al obtener el estado: ${response.statusText}`);
  }
  return response.json();
}

export async function ingestFile(file: File): Promise<IngestFileResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/ingest/file`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Error al ingestar el archivo: ${response.statusText}`);
  }
  return response.json();
}

export async function ingestDirectory(): Promise<IngestDirectoryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ingest/directory`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Error al ingestar el directorio: ${response.statusText}`);
  }
  return response.json();
}
