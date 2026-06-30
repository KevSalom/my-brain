import React from 'react';
import { Database, RefreshCw, FileText, AlertCircle } from 'lucide-react';
import type { StatusResponse } from '../types';
import { RagConfig } from './RagConfig';

interface StatusPanelProps {
  status: StatusResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ status, loading, error, onRefresh }) => {
  return (
    <div className="flex flex-col gap-6 text-zinc-200 select-none font-sans">
      {/* Header with right padding to prevent collision with modal's absolute close button */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 pr-10">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-brand-primary transition-colors duration-300" />
          <h2 className="font-semibold text-zinc-100 text-sm">Brain Status</h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer focus:outline-none"
          title="Update status"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-900/50 bg-rose-950/20 text-rose-300 text-xs leading-relaxed">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>Connection error: {error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900/40 border border-zinc-800/80 p-3.5 rounded-xl backdrop-blur-sm">
          <p className="text-[11px] text-zinc-550 font-bold uppercase tracking-wider">Documents</p>
          <p className="text-xl font-bold text-zinc-100 mt-1">
            {status ? status.total_documents : '--'}
          </p>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800/80 p-3.5 rounded-xl backdrop-blur-sm">
          <p className="text-[11px] text-zinc-550 font-bold uppercase tracking-wider">RAG Chunks</p>
          <p className="text-xl font-bold text-zinc-100 mt-1">
            {status ? status.total_chunks : '--'}
          </p>
        </div>
      </div>

      {/* Config Section */}
      <RagConfig status={status} />

      {/* Source Files List */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <span className="text-[11px] text-zinc-550 font-bold uppercase tracking-wider">
          Loaded Documents ({status?.sources.length || 0})
        </span>
        <div className="flex-1 overflow-y-auto max-h-[180px] border border-zinc-800/80 rounded-xl bg-zinc-900/10 p-2 scrollbar-thin">
          {status && status.sources.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {status.sources.map((src, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800/40 transition-colors text-xs text-zinc-300 font-mono truncate"
                  title={src}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-550" />
                  <span className="truncate flex-1">{src}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic p-3 text-center">
              No documents loaded in the brain.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
