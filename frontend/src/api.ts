import type { 
  StatusResponse, 
  IngestFileResponse, 
  IngestDirectoryResponse,
  AreaResponse,
  DocumentResponse,
  ConversationResponse,
  MessageResponse
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// =====================================================================
// System Status
// =====================================================================

export async function getStatus(): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/status`);
  if (!response.ok) {
    throw new Error(`Error al obtener el estado: ${response.statusText}`);
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

// =====================================================================
// Areas (Áreas)
// =====================================================================

export async function getAreas(): Promise<AreaResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/areas`);
  if (!response.ok) {
    throw new Error(`Error al listar áreas: ${response.statusText}`);
  }
  return response.json();
}

export async function createArea(name: string, description?: string, color?: string): Promise<AreaResponse> {
  const response = await fetch(`${API_BASE_URL}/api/areas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, color }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Error al crear área: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteArea(areaId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/areas/${areaId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Error al eliminar área: ${response.statusText}`);
  }
}

// =====================================================================
// Documents (Documentos por Área)
// =====================================================================

export async function getAreaDocuments(areaId: string): Promise<DocumentResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/areas/${areaId}/documents`);
  if (!response.ok) {
    throw new Error(`Error al cargar documentos del área: ${response.statusText}`);
  }
  return response.json();
}

export async function ingestFileToArea(areaId: string, file: File): Promise<IngestFileResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/areas/${areaId}/ingest/file`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Error al subir el archivo: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteAreaDocument(areaId: string, docId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/areas/${areaId}/documents/${docId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Error al eliminar documento: ${response.statusText}`);
  }
}

// =====================================================================
// Conversations (Conversaciones por Área)
// =====================================================================

export async function getAreaConversations(areaId: string): Promise<ConversationResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/chat/areas/${areaId}/conversations`);
  if (!response.ok) {
    throw new Error(`Error al listar conversaciones: ${response.statusText}`);
  }
  return response.json();
}

export async function createConversation(areaId: string, title?: string): Promise<ConversationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat/areas/${areaId}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Error al crear conversación: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteConversation(convId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${convId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Error al eliminar conversación: ${response.statusText}`);
  }
}

export async function getConversationMessages(convId: string): Promise<MessageResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${convId}/messages`);
  if (!response.ok) {
    throw new Error(`Error al cargar mensajes: ${response.statusText}`);
  }
  return response.json();
}
