export interface ConfigInfo {
  llm_model: string;
  embedding_model: string;
  chunking_strategy: string;
  retrieval_strategy: string;
  retrieval_bm25_weight: number;
  chunk_size: number;
  chunk_overlap: number;
}

export interface StatusResponse {
  collection_name: string;
  total_chunks: number;
  total_documents: number;
  sources: string[];
  config: ConfigInfo;
}

export interface IngestFileResponse {
  filename: string;
  chunks: number;
  message: string;
}

export interface IngestDirectoryResponse {
  directory: string;
  files_processed: number;
  total_chunks: number;
  results: Record<string, number>;
  message: string;
}

export interface SourceInfo {
  source: string;
  chunk_index: number;
  file_type: string;
  relevance_score: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceInfo[];
}

export interface AreaResponse {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  document_count: number;
  conversation_count: number;
}

export interface DocumentResponse {
  id: number;
  filename: string;
  file_path: string;
  file_size: number;
  area_id: string;
  created_at: string;
}

export interface ConversationResponse {
  id: string;
  title: string;
  area_id: string;
  created_at: string;
}

export interface MessageResponse {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources_json: string | null;
  conversation_id: string;
  created_at: string;
}

