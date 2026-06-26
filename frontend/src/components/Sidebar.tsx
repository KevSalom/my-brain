import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
  Info,
  Edit3,
  Link,
  Loader2,
  Sun,
  Moon
} from 'lucide-react';
import { ingestUrlToArea, ingestTextToArea } from '../api';
import { convertHtmlToMarkdown } from '../utils/htmlToMarkdown';
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

  const handleSaveRename = (id: string) => {
    const trimmed = editTitleValue.trim();
    if (trimmed) {
      onRenameConversation(id, trimmed);
    }
    setEditingConvId(null);
  };

  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkStatus, setLinkStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteStatus, setPasteStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const handlePasteIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = pasteTitle.trim();
    const content = pasteContent.trim();
    if (!title || !content) return;
    if (!selectedAreaId) {
      setPasteStatus({ type: 'error', message: 'Select or create an Area first.' });
      return;
    }

    setPasteLoading(true);
    setPasteStatus({ type: null, message: '' });

    try {
      const res = await ingestTextToArea(selectedAreaId, title, content);
      setPasteStatus({
        type: 'success',
        message: `Ingested! Saved as: ${res.filename} (${res.chunks} chunks created)`,
      });
      setPasteTitle('');
      setPasteContent('');
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      setTimeout(() => {
        setIsPasteModalOpen(false);
        setPasteStatus({ type: null, message: '' });
      }, 1500);
    } catch (err: any) {
      setPasteStatus({
        type: 'error',
        message: err.message || 'Error ingesting text.',
      });
    } finally {
      setPasteLoading(false);
    }
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      const markdown = convertHtmlToMarkdown(html);
      setPasteContent(markdown);
    }
  };

  const handleIngestUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = linkUrl.trim();
    if (!targetUrl) return;
    if (!selectedAreaId) {
      setLinkStatus({ type: 'error', message: 'Select or create an Area first.' });
      return;
    }
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      setLinkStatus({ type: 'error', message: 'URL must start with http:// or https://' });
      return;
    }

    setLinkLoading(true);
    setLinkStatus({ type: null, message: '' });

    try {
      const res = await ingestUrlToArea(selectedAreaId, targetUrl);
      setLinkStatus({
        type: 'success',
        message: `Ingested! Saved as: ${res.filename} (${res.chunks} chunks created)`,
      });
      setLinkUrl('');
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setLinkStatus({
        type: 'error',
        message: err.message || 'Error ingesting URL.',
      });
    } finally {
      setLinkLoading(false);
    }
  };

  // Helper to format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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
            const areaColor = area.color || '#f59e0b';
            
            let bg = `${areaColor}15`;
            let border = `${areaColor}30`;
            let text = '#a1a1aa'; // text-zinc-400
            
            if (isSelected) {
              bg = areaColor;
              border = areaColor;
              text = '#ffffff';
            } else if (isHovered) {
              bg = `${areaColor}35`;
              border = `${areaColor}70`;
              text = '#f4f4f5'; // text-zinc-100
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
                className={`group relative w-11 h-11 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all duration-300 hover:rounded-2xl cursor-pointer`}
              >
                <span className="relative z-10 leading-none">{initial}</span>
              </button>
            );
          })}

          <button
            onClick={onCreateAreaClick}
            title="Create New Area"
            className="w-11 h-11 rounded-full bg-zinc-900/40 border border-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 hover:border-zinc-700 hover:rounded-2xl transition-all duration-300 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        {/* Theme Toggle & Stats at bottom */}
        <div className="mt-auto flex flex-col items-center gap-3">
          <button
            onClick={onThemeToggle}
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="w-11 h-11 rounded-full bg-zinc-900/40 border border-brand-border flex items-center justify-center text-zinc-500 hover:text-brand-primary hover:bg-brand-primary/10 hover:border-brand-primary/25 hover:rounded-2xl transition-all duration-300 cursor-pointer"
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
            className="w-11 h-11 rounded-full bg-zinc-900/40 border border-brand-border flex items-center justify-center text-zinc-500 hover:text-brand-primary hover:bg-brand-primary/10 hover:border-brand-primary/25 hover:rounded-2xl transition-all duration-300 cursor-pointer"
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
                <h2 className="font-bold text-xs text-zinc-200 truncate flex items-center gap-1.5">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: activeArea.color || '#f59e0b' }}
                  />
                  {activeArea.name}
                </h2>
                {activeArea.description && (
                  <p className="text-[11px] text-zinc-500 truncate mt-0.5">
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
                    Chat Threads
                  </span>
                  <button
                    onClick={onCreateConversation}
                    className="flex items-center gap-1 text-[10px] text-brand-primary hover:text-brand-primary-hover font-bold transition-colors cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> New Chat
                  </button>
                </div>
                
                {conversations.length > 0 || selectedConversationId === null ? (
                  <div className="flex flex-col gap-1">
                    {selectedConversationId === null && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/40 border-brand-border border text-zinc-100 font-medium">
                        <div className="flex items-center gap-2 min-w-0 flex-1 text-left text-xs text-ellipsis overflow-hidden select-none">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-brand-primary animate-pulse" />
                          <span className="truncate italic text-zinc-300">New Conversation...</span>
                        </div>
                      </div>
                    )}
                    {conversations.map(conv => {
                      const isActive = conv.id === selectedConversationId;
                      if (editingConvId === conv.id) {
                        return (
                          <div
                            key={conv.id}
                            className="flex items-center gap-2 p-1.5 rounded-xl border border-brand-border bg-zinc-800/40 w-full"
                          >
                            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-brand-primary ml-1" />
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
                          
                          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 ml-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingConvId(conv.id);
                                setEditTitleValue(conv.title);
                              }}
                              title="Rename Chat"
                              className="p-1 rounded hover:text-zinc-200 hover:bg-zinc-800 transition-all duration-200 cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const confirmed = await showConfirm(`Delete conversation "${conv.title}"?`, "Delete Chat Thread");
                                if (confirmed) {
                                  onDeleteConversation(conv.id);
                                }
                              }}
                              title="Delete Chat"
                              className="p-1 rounded hover:text-rose-400 hover:bg-rose-950/25 transition-all duration-200 cursor-pointer ml-1"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-650 italic py-2 pl-2">
                    No chats started.
                  </p>
                )}
              </div>

              {/* Ingest Zone */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Ingest Document
                  </span>
                  <button
                    onClick={() => {
                      setPasteStatus({ type: null, message: '' });
                      setIsPasteModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-[10px] text-brand-primary hover:text-brand-primary-hover font-bold transition-colors cursor-pointer"
                  >
                    <Edit3 className="h-3 w-3" /> Paste Text
                  </button>
                </div>
                <UploadZone areaId={selectedAreaId} onUploadSuccess={onUploadSuccess} />
              </div>

              {/* Ingest Web Link */}
              <div className="flex flex-col gap-2 border-t border-zinc-900/60 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Ingest Web Link
                </span>
                <form onSubmit={handleIngestUrl} className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                      <input
                        type="url"
                        placeholder="https://example.com/article"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        disabled={linkLoading}
                        className="w-full bg-zinc-900/40 border border-zinc-800 text-xs rounded-xl pl-9 pr-3 py-2 text-zinc-250 placeholder-zinc-650 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all disabled:opacity-50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={linkLoading || !linkUrl.trim()}
                      className="px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-350 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-350 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {linkLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-primary" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {linkStatus.type && (
                    <div
                      className={`flex items-start gap-2 p-2 rounded-lg border text-xs leading-relaxed ${
                        linkStatus.type === 'success'
                          ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                          : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                      }`}
                    >
                      <span className="break-all">{linkStatus.message}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* Documents List */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Area Documents ({documents.length})
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
                    <p className="text-xs text-zinc-650">
                      No documents loaded.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
            <Info className="h-7 w-7 text-zinc-700 mb-2 animate-bounce" />
            <p className="text-xs font-medium text-zinc-400">No Area Selected</p>
            <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
              Create or select a bubble in the left column to manage your brain.
            </p>
          </div>
        )}
      </aside>

      {isPasteModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-xl bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-205">
            <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/40">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-brand-primary" />
                Paste Document Text (Markdown Auto-format)
              </h3>
              <button
                onClick={() => setIsPasteModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
            
            <form onSubmit={handlePasteIngest} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Document Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. OpenAI Lied About Solving Math"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  required
                  className="w-full bg-zinc-900/40 border border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all"
                />
              </div>

              <div className="flex-1 flex flex-col gap-1.5 min-h-[250px]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Content
                  </label>
                  <span className="text-xs text-zinc-500 italic">
                    Paste rich text from Medium/Substack for auto-markdown conversion
                  </span>
                </div>
                <textarea
                  placeholder="Paste your copied text here..."
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  onPaste={handleTextareaPaste}
                  required
                  className="flex-1 w-full bg-zinc-900/40 border border-zinc-800 text-xs rounded-xl px-3 py-2 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all font-mono resize-none h-60"
                />
              </div>

              {pasteStatus.type && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl border text-xs leading-relaxed ${
                    pasteStatus.type === 'success'
                      ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                      : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                  }`}
                >
                  <span className="break-all">{pasteStatus.message}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-850 text-xs text-zinc-400 hover:text-zinc-250 hover:bg-zinc-900 transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={pasteLoading || !pasteTitle.trim() || !pasteContent.trim()}
                  className="px-4 py-2 rounded-xl bg-brand-primary text-xs font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-40 disabled:hover:bg-brand-primary flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {pasteLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Ingesting...
                    </>
                  ) : (
                    'Ingest Text'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
