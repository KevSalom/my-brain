import React from 'react';
import { Settings } from 'lucide-react';
import type { StatusResponse } from '../types';

interface RagConfigProps {
  status: StatusResponse | null;
}

export const RagConfig: React.FC<RagConfigProps> = ({ status }) => {
  if (!status) {
    return (
      <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 flex flex-col gap-3.5 font-sans">
        <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-2">
          <Settings className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            RAG Configuration
          </span>
        </div>
        <p className="text-xs text-zinc-500 italic">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 flex flex-col gap-3.5 font-sans">
      <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-2">
        <Settings className="h-4 w-4 text-zinc-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          RAG Configuration
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs">
        <div>
          <span className="text-zinc-550 block font-medium">Active LLM</span>
          <span className="font-mono text-zinc-300 truncate block mt-0.5" title={status.config.llm_model}>
            {status.config.llm_model}
          </span>
        </div>
        <div>
          <span className="text-zinc-550 block font-medium">Embeddings</span>
          <span className="font-mono text-zinc-300 truncate block mt-0.5" title={status.config.embedding_model}>
            {status.config.embedding_model}
          </span>
        </div>
        <div>
          <span className="text-zinc-550 block font-medium">Strategy</span>
          <span className="capitalize text-zinc-300 block mt-0.5">
            {status.config.retrieval_strategy}
          </span>
        </div>
        <div>
          <span className="text-zinc-550 block font-medium">BM25 Weight</span>
          <span className="font-mono text-zinc-300 block mt-0.5">
            {(status.config.retrieval_bm25_weight * 100).toFixed(0)}%
          </span>
        </div>
        <div>
          <span className="text-zinc-550 block font-medium">Chunk Size / Overlap</span>
          <span className="font-mono text-zinc-300 block mt-0.5">
            {status.config.chunk_size} / {status.config.chunk_overlap}
          </span>
        </div>
        <div>
          <span className="text-zinc-550 block font-medium">Chunk Strategy</span>
          <span className="capitalize text-zinc-300 block mt-0.5">
            {status.config.chunking_strategy}
          </span>
        </div>
      </div>
    </div>
  );
};
