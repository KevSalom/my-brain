import type { 
  StatusResponse, 
  IngestFileResponse, 
  IngestDirectoryResponse,
  AreaResponse,
  DocumentResponse,
  ConversationResponse,
  MessageResponse,
  ModelInfo,
  UsageSummary,
  ConversationUsageResponse
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// =====================================================================
// System Status
// =====================================================================

export async function getStatus(): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/status`);
  if (!response.ok) {
    throw new Error(`Failed to get status: ${response.statusText}`);
  }
  return response.json();
}

export async function ingestDirectory(): Promise<IngestDirectoryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/ingest/directory`, {
    method: 'POST',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to ingest directory: ${response.statusText}`);
  }
  return response.json();
}

// =====================================================================
// Areas (Knowledge Areas)
// =====================================================================

export async function getAreas(): Promise<AreaResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/areas`);
  if (!response.ok) {
    throw new Error(`Failed to list knowledge areas: ${response.statusText}`);
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
    throw new Error(errData.detail || `Failed to create knowledge area: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteArea(areaId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/areas/${areaId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to delete knowledge area: ${response.statusText}`);
  }
}

// =====================================================================
// Documents
// =====================================================================

export async function getAreaDocuments(areaId: string): Promise<DocumentResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/areas/${areaId}/documents`);
  if (!response.ok) {
    throw new Error(`Failed to load area documents: ${response.statusText}`);
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
    throw new Error(errData.detail || `Failed to upload file: ${response.statusText}`);
  }
  return response.json();
}

export async function ingestUrlToArea(areaId: string, url: string): Promise<IngestFileResponse> {
  const response = await fetch(`${API_BASE_URL}/api/areas/${areaId}/ingest/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to ingest link: ${response.statusText}`);
  }
  return response.json();
}

export async function ingestTextToArea(areaId: string, title: string, content: string): Promise<IngestFileResponse> {
  const response = await fetch(`${API_BASE_URL}/api/areas/${areaId}/ingest/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to ingest text: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteAreaDocument(areaId: string, docId: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/areas/${areaId}/documents/${docId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to delete document: ${response.statusText}`);
  }
}

// =====================================================================
// Conversations
// =====================================================================

export async function getAreaConversations(areaId: string): Promise<ConversationResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/chat/areas/${areaId}/conversations`);
  if (!response.ok) {
    throw new Error(`Failed to list conversations: ${response.statusText}`);
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
    throw new Error(errData.detail || `Failed to create conversation: ${response.statusText}`);
  }
  return response.json();
}

export async function updateConversationTitle(convId: string, title: string): Promise<ConversationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${convId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to update conversation: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteConversation(convId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${convId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to delete conversation: ${response.statusText}`);
  }
}

export async function getConversationMessages(convId: string): Promise<MessageResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${convId}/messages`);
  if (!response.ok) {
    
    throw new Error(`Failed to load messages: ${response.statusText}`);
  }
  return response.json();
}

export async function getModelInfo(): Promise<ModelInfo> {
  const response = await fetch(`${API_BASE_URL}/api/model-info`);
  if (!response.ok) {
    throw new Error(`Failed to get model info: ${response.statusText}`);
  }
  return response.json();
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const response = await fetch(`${API_BASE_URL}/api/usage/summary`);
  if (!response.ok) {
    throw new Error(`Failed to get usage summary: ${response.statusText}`);
  }
  return response.json();
}

export async function getConversationUsage(convId: string): Promise<ConversationUsageResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${convId}/usage`);
  if (!response.ok) {
    throw new Error(`Failed to get conversation usage: ${response.statusText}`);
  }
  return response.json();
}
