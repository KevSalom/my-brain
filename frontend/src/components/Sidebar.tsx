import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IngestModal } from './IngestModal';
import type { AreaResponse, DocumentResponse, ConversationResponse } from '../types';
import { 
  BrainCircuit, 
  Trash2, 
  Plus, 
  FileText, 
  FolderOpen,
  Info,
  Edit3,
  Sun,
  Moon,
  MoreVertical
} from 'lucide-react';
import { useAlert } from '../context/AlertDialogContext';

interface SidebarProps {
  isOpen: boolean;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
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
  onRenameConversation: (id: string, newTitle: string) => void;

  // Documents
  documents: DocumentResponse[];
  onDeleteDocument: (docId: number) => void;
  onUploadSuccess: () => void;

  // Brain status modal trigger
  onBrainStatusClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  theme,
  onThemeToggle,
  areas,
  selectedAreaId,
  onCreateAreaClick,
  onDeleteArea,
  conversations,
  selectedConversationId,
  onCreateConversation,
  onDeleteConversation,
  onRenameConversation,
  documents,
  onDeleteDocument,
  onUploadSuccess,
  onBrainStatusClick
}) => {
  const navigate = useNavigate();
  const { confirm: showConfirm } = useAlert();
  const [hoveredAreaId, setHoveredAreaId] = useState<string | null>(null);
  const activeArea = areas.find(a => a.id === selectedAreaId);

  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState<string>('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // State for Ingest Modal (Unified)
  const [isUnifiedIngestOpen, setIsUnifiedIngestOpen] = useState(false);

  const handleSaveRename = (id: string) => {
    const trimmed = editTitleValue.trim();
    if (trimmed) {
      onRenameConversation(id, trimmed);
    }
    setEditingConvId(null);
  };

  // Cierra el menú desplegable al hacer clic fuera del mismo
  useEffect(() => {
    if (activeMenuId === null) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.chat-options-trigger') || target.closest('.chat-options-dropdown')) {
        return;
      }
      setActiveMenuId(null);
    };

    document.addEventListener('click', handleOutsideClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleOutsideClick, { capture: true });
    };
  }, [activeMenuId]);

  // Helper to format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderChatsList = () => {
    if (conversations.length === 0 && selectedConversationId !== null) {
      return (
        <p className="text-xs text-zinc-600 italic py-2 pl-2">
          No chats started.
        </p>
      );
    }
    
    return (
      <div className="flex flex-col gap-1 font-sans">
        {selectedConversationId === null && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/30 border-brand-border border text-zinc-100 font-medium">
            <div className="flex items-center min-w-0 flex-1 text-left text-xs text-ellipsis overflow-hidden select-none">
              <span className="truncate italic text-zinc-400">New Conversation...</span>
            </div>
          </div>
        )}
        {[...conversations].reverse().map(conv => {
          const isActive = conv.id === selectedConversationId;
          if (editingConvId === conv.id) {
            return (
              <div
                key={conv.id}
                className="flex items-center p-1.5 rounded-xl border border-brand-border bg-zinc-800/40 w-full"
              >
                <input
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveRename(conv.id);
                    } else if (e.key === 'Escape') {
                      setEditingConvId(null);
                    }
                  }}
                  onBlur={() => handleSaveRename(conv.id)}
                  autoFocus
                  className="flex-1 bg-transparent text-xs text-zinc-100 outline-none border-none p-0 focus:ring-0"
                />
              </div>
            );
          }
          return (
            <div
              key={conv.id}
              className={`group flex items-center justify-between pl-2.5 pr-1 py-1.5 rounded-xl transition-all duration-200 border relative ${
                isActive
                  ? 'bg-zinc-800/40 border-brand-border text-zinc-100 font-medium shadow-sm'
                  : 'border-transparent text-zinc-400 hover:bg-zinc-900/30 hover:text-zinc-200'
              }`}
            >
              <button
                onClick={() => navigate(`/areas/${selectedAreaId}/chats/${conv.id}`)}
                className="flex items-center min-w-0 flex-1 text-left text-xs text-ellipsis overflow-hidden cursor-pointer"
              >
                <span className="truncate">{conv.title}</span>
              </button>
              
              <div className="flex items-center shrink-0 ml-1.5 relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuId(activeMenuId === conv.id ? null : conv.id);
                  }}
                  title="Chat Options"
                  className="chat-options-trigger p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all duration-150 cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>

                {activeMenuId === conv.id && (
                  <div className="chat-options-dropdown absolute right-0 top-7 w-32 rounded-xl border border-brand-border bg-zinc-950 p-1 z-40 shadow-2xl animate-fade-in-fast text-xs font-sans">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(null);
                        setEditingConvId(conv.id);
                        setEditTitleValue(conv.title);
                      }}
                      className="flex items-center gap-2 w-full p-2 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg text-left cursor-pointer transition-colors"
                    >
                      <Edit3 className="h-3 w-3 text-zinc-400" />
                      <span>Rename</span>
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setActiveMenuId(null);
                        const confirmed = await showConfirm(`Delete conversation "${conv.title}"?`, "Delete Chat Thread");
                        if (confirmed) {
                          onDeleteConversation(conv.id);
                        }
                      }}
                      className="flex items-center gap-2 w-full p-2 text-rose-450 hover:text-rose-350 hover:bg-rose-950/20 rounded-lg text-left cursor-pointer transition-colors mt-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDocumentsList = () => {
    if (documents.length === 0) {
      return (
        <div className="flex flex-col items-center gap-1 py-4 text-center border border-dashed border-zinc-900/60 rounded-xl bg-zinc-950/10 font-sans">
          <FolderOpen className="h-5 w-5 text-zinc-700" />
          <p className="text-xs text-zinc-500">
            No loaded documents.
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto scrollbar-thin pr-1 font-sans">
        {documents.map(doc => (
          <div
            key={doc.id}
            className="group flex items-center justify-between p-2 rounded-xl bg-zinc-950/20 border border-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950/40 hover:border-zinc-800/85 transition-colors duration-150"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-mono truncate leading-none">{doc.filename}</span>
                <span className="text-[10px] text-zinc-500 mt-1">{formatSize(doc.file_size)}</span>
              </div>
            </div>
            <button
              onClick={async () => {
                const confirmed = await showConfirm(`Delete document "${doc.filename}"? This will remove its data from the database and vector store.`, "Delete Document");
                if (confirmed) {
                  onDeleteDocument(doc.id);
                }
              }}
              className="hidden group-hover:block p-1 rounded text-zinc-500 hover:text-rose-450 hover:bg-rose-950/20 transition-all duration-100 cursor-pointer ml-1 animate-fade-in"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`h-full flex overflow-hidden shrink-0 border-r border-brand-border fixed inset-y-0 left-0 z-40 bg-zinc-950/95 shadow-2xl transition-transform duration-300 ease-in-out md:static md:translate-x-0 md:shadow-none md:z-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
            const isHovered = hoveredAreaId === area.id;
            const isDark = theme === 'dark';
            const areaColor = area.color || '#f59e0b';
            
            let bg = isDark ? `${areaColor}15` : `${areaColor}10`;
            let border = isDark ? `${areaColor}30` : `${areaColor}40`;
            let text = isDark ? '#a1a1aa' : '#52525b'; // zinc-400 vs zinc-600
            
            if (isSelected) {
              bg = areaColor;
              border = areaColor;
              text = '#ffffff';
            } else if (isHovered) {
              bg = isDark ? `${areaColor}35` : `${areaColor}20`;
              border = isDark ? `${areaColor}70` : `${areaColor}60`;
              text = isDark ? '#f4f4f5' : '#09090b'; // zinc-100 vs zinc-950
            }
            
            return (
              <button
                key={area.id}
                onClick={() => navigate(`/areas/${area.id}`)}
                onMouseEnter={() => setHoveredAreaId(area.id)}
                onMouseLeave={() => setHoveredAreaId(null)}
                title={area.name}
                style={{ 
                  backgroundColor: bg,
                  borderColor: border,
                  color: text,
                  boxShadow: isSelected ? `0 0 14px ${areaColor}50` : isHovered ? `0 0 8px ${areaColor}25` : 'none'
                }}
                className={`group relative w-11 h-11 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-150 cursor-pointer`}
              >
                <span className="relative z-10 leading-none">{initial}</span>
              </button>
            );
          })}

          <button
            onClick={onCreateAreaClick}
            title="Create New Area"
            className="w-11 h-11 rounded-full bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 hover:border-zinc-700 transition-all duration-150 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        {/* Theme Toggle & Stats at bottom */}
        <div className="mt-auto flex flex-col items-center gap-3">
          <button
            onClick={onThemeToggle}
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="w-11 h-11 rounded-full bg-zinc-900/40 border border-brand-border flex items-center justify-center text-zinc-500 hover:text-brand-primary hover:bg-brand-primary/10 hover:border-brand-primary/25 transition-all duration-150 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-zinc-400" />
            ) : (
              <Moon className="h-4 w-4 text-zinc-400" />
            )}
          </button>

          <button
            onClick={onBrainStatusClick}
            title="Brain Status (Stats)"
            className="w-11 h-11 rounded-full bg-zinc-900/40 border border-brand-border flex items-center justify-center text-zinc-500 hover:text-brand-primary hover:bg-brand-primary/10 hover:border-brand-primary/25 transition-all duration-150 cursor-pointer"
          >
            <BrainCircuit className="h-4 w-4 text-zinc-400" />
          </button>
        </div>
      </aside>

      {/* 2. Sub-Sidebar: Navigation & Management for the active Area */}
      <aside className="w-64 h-full bg-brand-bg-sidebar flex flex-col backdrop-blur-md shrink-0">
        {activeArea ? (
          <>
            {/* Area Header */}
            <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/10 gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-xs text-zinc-200 truncate flex items-center gap-1.5 font-sans">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: activeArea.color || '#f59e0b' }}
                  />
                  {activeArea.name}
                </h2>
                {activeArea.description && (
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-sans">
                    {activeArea.description}
                  </p>
                )}
              </div>
              <button
                onClick={async () => {
                  const confirmed = await showConfirm(`Are you sure you want to delete the area "${activeArea.name}"? This will permanently delete its documents, chats, and history.`, "Delete Knowledge Area");
                  if (confirmed) {
                    onDeleteArea(activeArea.id);
                  }
                }}
                title="Delete Area"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-450 hover:bg-rose-950/20 transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scrollable Navigation Sections - Unified Modal Design permanently */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 scrollbar-thin animate-fade-in font-sans">
              <button
                onClick={() => setIsUnifiedIngestOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/18 transition-all font-semibold text-xs cursor-pointer shadow-[0_0_12px_rgba(245,158,11,0.04)]"
              >
                <Plus className="h-4 w-4" />
                Ingestar Documento
              </button>

              {/* Chats List */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Conversaciones
                  </span>
                  <button
                    onClick={onCreateConversation}
                    className="flex items-center gap-1 text-[10px] text-brand-primary hover:text-brand-primary-hover font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Nuevo Chat
                  </button>
                </div>
                {renderChatsList()}
              </div>

              {/* Documents List */}
              <div className="flex flex-col gap-2.5 border-t border-zinc-900/60 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Documentos ({documents.length})
                </span>
                {renderDocumentsList()}
              </div>
            </div>

          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 font-sans">
            <Info className="h-7 w-7 text-zinc-700 mb-2 animate-bounce" />
            <p className="text-xs font-medium text-zinc-400">No Area Selected</p>
            <p className="text-xs text-zinc-650 mt-2 leading-relaxed">
              Create or select a bubble in the left column to manage your brain.
            </p>
          </div>
        )}
      </aside>

      <IngestModal
        isOpen={isUnifiedIngestOpen}
        onClose={() => setIsUnifiedIngestOpen(false)}
        areaId={selectedAreaId}
        onUploadSuccess={onUploadSuccess}
      />
    </div>
  );
};
