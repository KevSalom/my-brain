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
