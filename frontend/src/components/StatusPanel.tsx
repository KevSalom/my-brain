import React, { useState } from 'react';
import { Database, Settings, RefreshCw, FileText, FolderInput, Loader2, AlertCircle } from 'lucide-react';
import type { StatusResponse } from '../types';
import { ingestDirectory } from '../api';

interface StatusPanelProps {
  status: StatusResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ status, loading, error, onRefresh }) => {
  const [ingestDirLoading, setIngestDirLoading] = useState(false);
  const [ingestDirStatus, setIngestDirStatus] = useState<string | null>(null);

  const handleIngestDirectory = async () => {
    setIngestDirLoading(true);
    setIngestDirStatus(null);
    try {
      const res = await ingestDirectory();
      setIngestDirStatus(`Éxito: ${res.message}`);
      onRefresh();
    } catch (err: any) {
      setIngestDirStatus(`Error: ${err.message || 'Ocurrió un error al ingestar.'}`);
    } finally {
      setIngestDirLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-200 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-violet-400" />
          <h2 className="font-semibold text-slate-100">Estado del Cerebro</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
          title="Actualizar estado"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-900/50 bg-rose-950/20 text-rose-300 text-xs leading-relaxed">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>Error de conexión: {error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-xl backdrop-blur-sm">
          <p className="text-xs text-slate-500 font-medium">Documentos</p>
          <p className="text-2xl font-semibold text-slate-100 mt-1">
            {status ? status.total_documents : '--'}
          </p>
        </div>
        <div className="bg-slate-900/40 border border-slate-800/80 p-3.5 rounded-xl backdrop-blur-sm">
          <p className="text-xs text-slate-500 font-medium">Chunks RAG</p>
          <p className="text-2xl font-semibold text-slate-100 mt-1">
            {status ? status.total_chunks : '--'}
          </p>
        </div>
      </div>

      {/* Config Section */}
      <div className="bg-slate-900/30 border border-slate-800/50 rounded-xl p-4 flex flex-col gap-3.5">
        <div className="flex items-center gap-2 border-b border-slate-800/50 pb-2">
          <Settings className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Configuración RAG
          </span>
        </div>
        
        {status ? (
          <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs">
            <div>
              <span className="text-slate-500 block">LLM Activo</span>
              <span className="font-mono text-slate-300 truncate block mt-0.5" title={status.config.llm_model}>
                {status.config.llm_model}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Embeddings</span>
              <span className="font-mono text-slate-300 truncate block mt-0.5" title={status.config.embedding_model}>
                {status.config.embedding_model}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Estrategia</span>
              <span className="capitalize text-slate-300 block mt-0.5">
                {status.config.retrieval_strategy}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Peso BM25</span>
              <span className="font-mono text-slate-300 block mt-0.5">
                {(status.config.retrieval_bm25_weight * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Chunk Size / Overlap</span>
              <span className="font-mono text-slate-300 block mt-0.5">
                {status.config.chunk_size} / {status.config.chunk_overlap}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Estrategia Chunk</span>
              <span className="capitalize text-slate-300 block mt-0.5">
                {status.config.chunking_strategy}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">Cargando configuración...</p>
        )}
      </div>

      {/* Directory Ingest Trigger */}
      <div className="w-full flex flex-col gap-2">
        <button
          onClick={handleIngestDirectory}
          disabled={ingestDirLoading || loading}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-600"
        >
          {ingestDirLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          ) : (
            <FolderInput className="h-4 w-4 text-violet-400" />
          )}
          <span>Cargar Directorio Local (/documents)</span>
        </button>
        {ingestDirStatus && (
          <p className={`text-[10px] leading-relaxed p-2 rounded-lg border ${
            ingestDirStatus.startsWith('Error')
              ? 'bg-rose-950/25 border-rose-900/50 text-rose-400'
              : 'bg-emerald-950/25 border-emerald-900/50 text-emerald-400'
          }`}>
            {ingestDirStatus}
          </p>
        )}
      </div>

      {/* Source Files List */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Documentos Cargados ({status?.sources.length || 0})
        </span>
        <div className="flex-1 overflow-y-auto max-h-[220px] border border-slate-800/80 rounded-xl bg-slate-900/10 p-2 scrollbar-thin">
          {status && status.sources.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {status.sources.map((src, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/40 transition-colors text-xs text-slate-300 font-mono truncate"
                  title={src}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate flex-1">{src}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic p-3 text-center">
              No hay documentos cargados en el cerebro.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
