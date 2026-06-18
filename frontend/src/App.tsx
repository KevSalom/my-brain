import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  useParams, 
  useNavigate 
} from 'react-router-dom';
import { type ThreadMessageLike } from '@assistant-ui/react';
import { Sidebar } from './components/Sidebar';
import { ChatContainer } from './components/ChatContainer';
import { StatusPanel } from './components/StatusPanel';
import { CreateAreaModal } from './components/CreateAreaModal';
import { 
  getStatus, 
  getAreas, 
  createArea, 
  deleteArea, 
  getAreaDocuments, 
  deleteAreaDocument,
  getAreaConversations,
  createConversation,
  deleteConversation,
  getConversationMessages,
  updateConversationTitle
} from './api';
import type { 
  StatusResponse, 
  AreaResponse, 
  DocumentResponse, 
  ConversationResponse, 
  SourceInfo 
} from './types';
import { Plus, Bot, MessageSquare } from 'lucide-react';

function MainApp() {
  const { areaId, chatId } = useParams<{ areaId?: string; chatId?: string }>();
  const navigate = useNavigate();

  const selectedAreaId = areaId || null;
  const selectedConversationId = chatId || null;

  // --- Estados del Sistema ---
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isViewingBrainStatus, setIsViewingBrainStatus] = useState(false);

  // --- Estados de Áreas ---
  const [areas, setAreas] = useState<AreaResponse[]>([]);
  const [isCreatingArea, setIsCreatingArea] = useState(false);

  // --- Estados de Hilos y Mensajes ---
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // --- Estados de Documentos ---
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);

  // =====================================================================
  // Carga de datos de la API
  // =====================================================================

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const data = await getStatus();
      setStatus(data);
    } catch (err: any) {
      setStatusError(err.message || 'Connection error with the backend.');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const refreshAreas = useCallback(async (autoSelectFirst = false) => {
    try {
      const list = await getAreas();
      setAreas(list);
      if (list.length > 0) {
        if (autoSelectFirst && selectedAreaId === null) {
          navigate(`/areas/${list[0].id}`);
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error("Error loading areas:", err);
    }
  }, [selectedAreaId, navigate]);

  const refreshAreaResources = useCallback(async () => {
    if (selectedAreaId === null) {
      setConversations([]);
      setDocuments([]);
      setMessages([]);
      return;
    }

    try {
      // 1. Cargar documentos del área
      const docsList = await getAreaDocuments(selectedAreaId);
      setDocuments(docsList);

      // 2. Cargar hilos del área
      const convList = await getAreaConversations(selectedAreaId);
      setConversations(convList);
    } catch (err) {
      console.error("Error refreshing area resources:", err);
    }
  }, [selectedAreaId]);

  const refreshMessages = useCallback(async () => {
    if (selectedConversationId === null) {
      setMessages([]);
      return;
    }
    setIsLoadingMessages(true);
    try {
      const list = await getConversationMessages(selectedConversationId);
      setMessages(list);
    } catch (err) {
      console.error("Error loading thread messages:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [selectedConversationId]);

  // =====================================================================
  // Efectos de Ciclo de Vida
  // =====================================================================

  // Carga inicial
  useEffect(() => {
    refreshStatus();
    refreshAreas(true);
  }, []);

  // Al cambiar el Área activa
  useEffect(() => {
    refreshAreaResources();
  }, [selectedAreaId, refreshAreaResources]);

  // Al cambiar la Conversación activa
  useEffect(() => {
    refreshMessages();
  }, [selectedConversationId, refreshMessages]);

  // =====================================================================
  // Operaciones / Handlers
  // =====================================================================

  const handleCreateArea = useCallback(async (name: string, description?: string, color?: string) => {
    if (!name.trim()) return;
    try {
      const created = await createArea(
        name.trim(),
        description?.trim() || undefined,
        color || '#3B82F6'
      );
      setIsCreatingArea(false);
      
      // Refrescar y navegar al área recién creada
      await refreshAreas(false);
      navigate(`/areas/${created.id}`);
    } catch (err: any) {
      alert(err.message || "Error creating area");
    }
  }, [refreshAreas, navigate]);

  const handleDeleteArea = async (id: string) => {
    try {
      await deleteArea(id);
      if (selectedAreaId === id) {
        navigate('/');
      }
      refreshAreas(true);
      refreshStatus();
    } catch (err: any) {
      alert(err.message || "Error deleting area");
    }
  };

  const handleCreateConversation = async () => {
    if (selectedAreaId === null) return;
    try {
      const newConv = await createConversation(selectedAreaId);
      
      // Refrescar lista e ir directamente al nuevo chat
      const convList = await getAreaConversations(selectedAreaId);
      setConversations(convList);
      navigate(`/areas/${selectedAreaId}/chats/${newConv.id}`);
    } catch (err: any) {
      alert(err.message || "Error creating conversation");
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      if (selectedConversationId === id) {
        navigate(`/areas/${selectedAreaId}`);
      }
      if (selectedAreaId !== null) {
        const convList = await getAreaConversations(selectedAreaId);
        setConversations(convList);
      }
    } catch (err: any) {
      alert(err.message || "Error deleting chat");
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await updateConversationTitle(id, newTitle);
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    } catch (err: any) {
      alert(err.message || "Error renaming conversation");
    }
  };

  const handleConversationTitleUpdated = useCallback((id: string, newTitle: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  }, []);

  const handleDeleteDocument = async (docId: number) => {
    if (selectedAreaId === null) return;
    try {
      await deleteAreaDocument(selectedAreaId, docId);
      const docsList = await getAreaDocuments(selectedAreaId);
      setDocuments(docsList);
      refreshStatus();
    } catch (err: any) {
      alert(err.message || "Error deleting document");
    }
  };

  // Mapear historial relacional al formato de assistant-ui
  const initialMessages = useMemo<ThreadMessageLike[]>(() => {
    return messages.map((m): ThreadMessageLike => {
      const sources: SourceInfo[] = m.sources_json ? JSON.parse(m.sources_json) : [];
      return {
        id: m.id.toString(),
        role: m.role as 'user' | 'assistant',
        content: [{ type: 'text', text: m.content }],
        ...(m.role === 'assistant' && sources.length > 0 ? { custom: { sources } } : {})
      };
    });
  }, [messages]);

  // Nombre del Área activa
  const activeAreaName = areas.find(a => a.id === selectedAreaId)?.name || '';

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-brand-bg font-sans antialiased text-brand-text relative">
      {/* Sidebar Split Panel (Burbujas + Listado) */}
      <Sidebar
        areas={areas}
        selectedAreaId={selectedAreaId}
        onCreateAreaClick={() => setIsCreatingArea(true)}
        onDeleteArea={handleDeleteArea}
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        onCreateConversation={handleCreateConversation}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        documents={documents}
        onDeleteDocument={handleDeleteDocument}
        onUploadSuccess={refreshAreaResources}
        onBrainStatusClick={() => setIsViewingBrainStatus(true)}
      />

      {/* Main Container */}
      <main className="flex-1 h-full flex flex-col min-w-0 bg-brand-bg relative">
        {selectedConversationId ? (
          isLoadingMessages ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
              <div className="h-6 w-6 rounded-full border-2 border-brand-primary border-t-transparent animate-spin mb-2" />
              <p className="text-xs">Loading message history...</p>
            </div>
          ) : (
            // El key en el ChatContainer fuerza a remontar y crear una runtime limpia
            <ChatContainer 
              key={selectedConversationId} 
              chatId={selectedConversationId} 
              initialMessages={initialMessages} 
              onConversationTitleUpdated={handleConversationTitleUpdated} 
            />
          )
        ) : (
          // Empty State / Welcome Screen
          <div className="flex-1 h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 select-none animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 shadow-[0_0_20px_var(--brand-shadow)] mb-5">
              <Bot className="h-10 w-10 text-brand-primary animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              My Brain <span className="text-brand-primary font-mono text-sm uppercase bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/30">LM</span>
            </h2>
            
            {selectedAreaId !== null ? (
              <>
                <p className="text-sm text-zinc-400 mt-2">
                  You are in area <span className="text-brand-primary font-bold">{activeAreaName}</span>.
                </p>
                <p className="text-xs text-zinc-550 mt-2 max-w-sm leading-relaxed">
                  Start a new chat in this area to begin querying its local documents.
                </p>
                <button
                  onClick={handleCreateConversation}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-zinc-950 font-bold hover:bg-brand-primary-hover shadow-[0_0_15px_var(--brand-shadow)] transition-all cursor-pointer text-xs"
                >
                  <MessageSquare className="h-4 w-4" /> Start First Chat
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-brand-primary/80 mt-1.5 italic tracking-wide">
                  "your docs, your local intelligence"
                </p>
                <p className="text-xs text-zinc-550 mt-3 max-w-sm leading-relaxed">
                  Create your first knowledge area in the left panel (e.g., "Code", "Studies", "Finance") to start organizing and ingesting documents.
                </p>
                <button
                  onClick={() => setIsCreatingArea(true)}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-zinc-950 font-bold hover:bg-brand-primary-hover shadow-[0_0_15px_var(--brand-shadow)] transition-all cursor-pointer text-xs"
                >
                  <Plus className="h-4 w-4" /> Create Knowledge Area
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Modal para Crear Área */}
      <CreateAreaModal
        isOpen={isCreatingArea}
        onClose={() => setIsCreatingArea(false)}
        onCreate={handleCreateArea}
      />

      {/* Modal de Estado del Cerebro */}
      {isViewingBrainStatus && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in animate-duration-300">
          <div className="relative bg-zinc-900/90 border border-brand-border rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Botón de cerrar */}
            <button
              onClick={() => setIsViewingBrainStatus(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer"
              title="Close modal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="overflow-y-auto pr-1 flex-1 scrollbar-thin">
              <StatusPanel
                status={status}
                loading={loadingStatus}
                error={statusError}
                onRefresh={refreshStatus}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/areas/:areaId" element={<MainApp />} />
        <Route path="/areas/:areaId/chats/:chatId" element={<MainApp />} />
      </Routes>
    </Router>
  );
}
