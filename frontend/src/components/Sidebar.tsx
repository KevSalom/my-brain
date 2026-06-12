import React from 'react';
import { UploadZone } from './UploadZone';
import { StatusPanel } from './StatusPanel';
import type { StatusResponse } from '../types';
import { BrainCircuit } from 'lucide-react';

interface SidebarProps {
  status: StatusResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ status, loading, error, onRefresh }) => {
  return (
    <aside className="w-80 h-full bg-slate-950/60 border-r border-slate-850 flex flex-col backdrop-blur-md shrink-0">
      {/* App Logo/Header */}
      <div className="flex items-center gap-3 p-5 border-b border-slate-900 bg-slate-950/20">
        <div className="p-2 rounded-xl bg-violet-600/10 border border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
          <BrainCircuit className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h1 className="font-semibold text-base text-slate-100 leading-tight">MyBrain</h1>
          <p className="text-[10px] text-violet-400 font-medium tracking-widest uppercase mt-0.5">
            IA Second Brain
          </p>
        </div>
      </div>

      {/* Sidebar Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 scrollbar-thin">
        {/* Upload Section */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ingestar Documento
          </span>
          <UploadZone onUploadSuccess={onRefresh} />
        </div>

        {/* Divider */}
        <hr className="border-slate-900" />

        {/* Status Section */}
        <StatusPanel
          status={status}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
        />
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/20 text-center">
        <p className="text-[10px] text-slate-600 font-mono">
          MyBrain MVP v1.0.0
        </p>
      </div>
    </aside>
  );
};
