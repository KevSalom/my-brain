import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadZone } from './UploadZone';
import type { AreaResponse, DocumentResponse, ConversationResponse } from '../types';
import { 
  BrainCircuit, 
  MessageSquare, 
  Trash2, 
  Plus, 
  FileText, 
  FolderOpen,
  Info
} from 'lucide-react';

interface SidebarProps {
  // Areas
  areas: AreaResponse[];
  selectedAreaId: string | null;
  onCreateAreaClick: () => void;
  onDeleteArea: (id: string) => void;

  // Conversations
  conversations: ConversationResponse[];
  selectedConversationId: string | null;
  onCreateConversation: () => void;
  onDeleteConversation: (id: string) => void;

  // Documents
  documents: DocumentResponse[];
  onDeleteDocument: (docId: number) => void;
  onUploadSuccess: () => void;

  // Brain status modal trigger
  onBrainStatusClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  areas,
  selectedAreaId,
  onCreateAreaClick,
  onDeleteArea,
  conversations,
  selectedConversationId,
  onCreateConversation,
  onDeleteConversation,
  documents,
  onDeleteDocument,
  onUploadSuccess,
  onBrainStatusClick
}) => {
  const navigate = useNavigate();
  const activeArea = areas.find(a => a.id === selectedAreaId);

  // Helper to format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="h-full flex overflow-hidden shrink-0 border-r border-brand-border">
      {/* 1. Discord-style Areas vertical panel */}
      <aside className="w-16 h-full bg-zinc-950/70 flex flex-col items-center py-5 gap-3 shrink-0 select-none">
        <div className="p-2 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 shadow-[0_0_12px_var(--brand-shadow)] mb-4">
          <BrainCircuit className="h-5 w-5 text-brand-primary animate-pulse" />
        </div>
        
        {/* Areas list */}
        <div className="flex-1 w-full overflow-y-auto flex flex-col items-center gap-3 scrollbar-none px-2">
          {areas.map(area => {
            const initial = area.name.substring(0, 2).toUpperCase();
            const isSelected = area.id === selectedAreaId;
            const areaColor = area.color || '#f59e0b';
            
            return (
              <button
                key={area.id}
                onClick={() => navigate(`/areas/${area.id}`)}
                title={area.name}
                style={{ borderColor: isSelected ? areaColor : 'transparent' }}
                className={`group relative w-11 h-11 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-300 hover:rounded-2xl cursor-pointer ${
                  isSelected 
                    ? 'bg-zinc-800 text-zinc-100 shadow-[0_0_10px_rgba(0,0,0,0.5)]'
                    : 'bg-zinc-900/60 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-100'
                }`}
              >
                <span className="relative z-10 leading-none">{initial}</span>
                {/* Visual indicator (pill) on left hover/select */}
                <div 
                  className={`absolute left-0 w-1 rounded-r transition-all duration-300 ${
                    isSelected ? 'h-6 -left-1' : 'h-0 -left-2 group-hover:h-3 group-hover:-left-1'
                  }`}
                  style={{ backgroundColor: areaColor }}
                />
              </button>
            );
          })}

          <button
            onClick={onCreateAreaClick}
            title="Crear Nueva Área"
            className="w-11 h-11 rounded-full bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 hover:border-zinc-700 hover:rounded-2xl transition-all duration-300 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        {/* Brain status trigger at bottom left */}
        <button
          onClick={onBrainStatusClick}
          title="Estado del Cerebro (Stats)"
          className="w-11 h-11 rounded-full bg-zinc-900/40 border border-zinc-850 flex items-center justify-center text-zinc-500 hover:text-brand-primary hover:bg-brand-primary/10 hover:border-brand-primary/25 hover:rounded-2xl transition-all duration-300 cursor-pointer mt-auto"
        >
          <BrainCircuit className="h-4 w-4 text-zinc-400" />
        </button>
      </aside>

      {/* 2. Sub-Sidebar: Navigation & Management for the active Area */}
      <aside className="w-64 h-full bg-brand-bg-sidebar flex flex-col backdrop-blur-md shrink-0">
        {activeArea ? (
          <>
            {/* Area Header */}
            <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/10 gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-sm text-zinc-200 truncate flex items-center gap-1.5">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: activeArea.color || '#f59e0b' }}
                  />
                  {activeArea.name}
                </h2>
                {activeArea.description && (
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                    {activeArea.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  if (confirm(`¿Estás seguro de eliminar el área "${activeArea.name}"? Esto borrará permanentemente sus documentos, chats e historial.`)) {
                    onDeleteArea(activeArea.id);
                  }
                }}
                title="Eliminar Área"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scrollable Navigation Sections */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-thin">
              {/* Chat conversations */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Hilos de Chat
                  </span>
                  <button
                    onClick={onCreateConversation}
                    className="flex items-center gap-1 text-[10px] text-brand-primary hover:text-brand-primary-hover font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Nuevo Chat
                  </button>
                </div>
                
                {conversations.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {conversations.map(conv => {
                      const isActive = conv.id === selectedConversationId;
                      return (
                        <div
                          key={conv.id}
                          className={`group flex items-center justify-between p-2 rounded-xl transition-all duration-200 border ${
                            isActive
                              ? 'bg-zinc-800/40 border-brand-border text-zinc-100 font-medium'
                              : 'border-transparent text-zinc-400 hover:bg-zinc-900/30 hover:text-zinc-200'
                          }`}
                        >
                          <button
                            onClick={() => navigate(`/areas/${selectedAreaId}/chats/${conv.id}`)}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left text-xs text-ellipsis overflow-hidden cursor-pointer"
                          >
                            <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-brand-primary' : 'text-zinc-500 group-hover:text-zinc-400'}`} />
                            <span className="truncate">{conv.title}</span>
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`¿Eliminar la conversación "${conv.title}"?`)) {
                                onDeleteConversation(conv.id);
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-rose-400 hover:bg-rose-950/25 transition-all duration-200 cursor-pointer ml-1.5"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-650 italic py-2 pl-2">
                    No hay chats iniciados.
                  </p>
                )}
              </div>

              {/* Ingest Zone */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Ingestar Documento
                </span>
                <UploadZone areaId={selectedAreaId} onUploadSuccess={onUploadSuccess} />
              </div>

              {/* Documents List */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Documentos del Área ({documents.length})
                </span>
                {documents.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {documents.map(doc => (
                      <div
                        key={doc.id}
                        className="group flex items-center justify-between p-2 rounded-xl bg-zinc-950/20 border border-zinc-900/60 text-zinc-450 hover:text-zinc-300 hover:bg-zinc-950/40 hover:border-zinc-800/80 transition-colors duration-200"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-mono truncate leading-none">{doc.filename}</span>
                            <span className="text-[9px] text-zinc-650 mt-1">{formatSize(doc.file_size)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar el documento "${doc.filename}"? Esto borrará sus datos de la base de datos relacional y sus vectores.`)) {
                              onDeleteDocument(doc.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all duration-200 cursor-pointer ml-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-4 text-center border border-dashed border-zinc-900 rounded-xl bg-zinc-950/10">
                    <FolderOpen className="h-5 w-5 text-zinc-750" />
                    <p className="text-[10px] text-zinc-600">
                      Sin documentos cargados.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
            <Info className="h-7 w-7 text-zinc-700 mb-2 animate-bounce" />
            <p className="text-xs font-medium text-zinc-400">Sin Área Seleccionada</p>
            <p className="text-[10px] text-zinc-650 mt-2 leading-relaxed">
              Crea o selecciona una burbuja en la columna izquierda para administrar tu cerebro.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};
