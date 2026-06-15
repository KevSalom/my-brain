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

export const Sidebar: React.FC<SidebarProps> = ({ 
  status, 
  loading, 
  error, 
  onRefresh
}) => {
  return (
    <aside className="w-80 h-full bg-brand-bg-sidebar border-r border-brand-border flex flex-col backdrop-blur-md shrink-0">
      {/* App Logo/Header */}
      <div className="flex items-center gap-3 p-5 border-b border-zinc-900 bg-zinc-950/20">
        <div className="p-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 shadow-[0_0_15px_var(--brand-shadow)]">
          <BrainCircuit className="h-6 w-6 text-brand-primary" />
        </div>
        <div>
          <h1 className="font-bold text-base text-zinc-100 leading-tight tracking-tight">My Brain <span className="text-brand-primary text-xs ml-1 font-mono uppercase bg-brand-primary/10 px-1 py-0.5 rounded border border-brand-primary/20">LM</span></h1>
          <p className="text-[10px] text-brand-primary font-semibold tracking-wider uppercase mt-1">
            Local Intelligence
          </p>
        </div>
      </div>

      {/* Sidebar Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 scrollbar-thin">
        {/* Upload Section */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Ingestar Documento
          </span>
          <UploadZone onUploadSuccess={onRefresh} />
        </div>

        {/* Divider */}
        <hr className="border-zinc-900" />

        {/* Status Section */}
        <StatusPanel
          status={status}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
        />
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-zinc-900 bg-zinc-950/20 text-center">
        <p className="text-[10px] text-zinc-600 font-mono">
          My Brain LM v1.0.0
        </p>
      </div>
    </aside>
  );
};

