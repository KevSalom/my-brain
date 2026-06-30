import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  useParams, 
  useNavigate 
} from 'react-router-dom';
import { type ThreadMessageLike } from '@assistant-ui/react';
import { AlertDialogProvider, useAlert } from './context/AlertDialogContext';
import { Sidebar } from './components/Sidebar';
import { ChatContainer } from './components/ChatContainer';
import { StatusPanel } from './components/StatusPanel';
import { CreateAreaModal } from './components/CreateAreaModal';
import { Modal } from './components/Modal';
import { 
  getStatus, 
  getAreas, 
  createArea, 
  deleteArea, 
  getAreaDocuments, 
  deleteAreaDocument,
  getAreaConversations,
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
import { Plus, Bot, Menu, BrainCircuit, Sun, Moon } from 'lucide-react';

function MainApp() {
  const { areaId, chatId } = useParams<{ areaId?: string; chatId?: string }>();
  const navigate = useNavigate();
  const { alert: showAlert } = useAlert();

  const selectedAreaId = areaId || null;
  const selectedConversationId = chatId || null;

  // --- Estados del Sistema ---
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isViewingBrainStatus, setIsViewingBrainStatus] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [areasLoaded, setAreasLoaded] = useState(false);

  // --- Tema Claro / Oscuro ---
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  // Aplicar tema en el elemento html raíz
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Deshabilitar transiciones temporalmente para evitar retrasos visuales
    root.classList.add('disable-transitions');
    
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }
    
    // Forzar repaint para aplicar los cambios de color de forma inmediata
    window.getComputedStyle(root).opacity;
    
    // Volver a habilitar las transiciones
    const timer = setTimeout(() => {
      root.classList.remove('disable-transitions');
    }, 0);
    
    return () => clearTimeout(timer);
  }, [theme]);

  // --- Estados de Áreas ---
  const [areas, setAreas] = useState<AreaResponse[]>([]);
  const [isCreatingArea, setIsCreatingArea] = useState(false);

  // --- Estados de Hilos y Mensajes ---
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // --- Estados de Documentos ---
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);

  // Evitar refetch y spinner de carga al transicionar de chat borrador (draft) a chat creado
  const skipMessageFetchRef = useRef<string | null>(null);

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
      setAreasLoaded(true);
      if (list.length > 0) {
        if (autoSelectFirst && selectedAreaId === null) {
          navigate(`/areas/${list[0].id}`);
        } else {
          setIsInitialLoading(false);
        }
      } else {
        navigate('/');
        setIsInitialLoading(false);
      }
    } catch (err) {
      console.error("Error loading areas:", err);
      setAreasLoaded(true);
      setIsInitialLoading(false);
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
    
    // Si ya cargamos los mensajes manualmente durante la transición, saltamos este fetch
    if (skipMessageFetchRef.current === selectedConversationId) {
      skipMessageFetchRef.current = null;
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

  // Apagar loader inicial si ya navegamos a un área y las áreas ya cargaron
  useEffect(() => {
    if (isInitialLoading && areasLoaded && selectedAreaId !== null) {
      setIsInitialLoading(false);
    }
  }, [selectedAreaId, areasLoaded, isInitialLoading]);

  // Al cambiar el Área activa
  useEffect(() => {
    refreshAreaResources();
  }, [selectedAreaId, refreshAreaResources]);

  // Al cambiar la Conversación activa
  useEffect(() => {
    refreshMessages();
  }, [selectedConversationId, refreshMessages]);

  // Auto-cerrar barra lateral en móvil al cambiar de ruta
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [selectedAreaId, selectedConversationId]);

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
      showAlert(err.message || "Error creating area", "Create Area Error");
    }
  }, [refreshAreas, navigate, showAlert]);

  const handleDeleteArea = async (id: string) => {
    try {
      await deleteArea(id);
      if (selectedAreaId === id) {
        navigate('/');
      }
      refreshAreas(true);
      refreshStatus();
    } catch (err: any) {
      showAlert(err.message || "Error deleting area", "Delete Area Error");
    }
  };

  const handleCreateConversation = useCallback(() => {
    if (selectedAreaId === null) return;
    navigate(`/areas/${selectedAreaId}`);
  }, [selectedAreaId, navigate]);

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      if (selectedConversationId === id) {
        setMessages([]);
        navigate(`/areas/${selectedAreaId}`, { replace: true });
      }
      if (selectedAreaId !== null) {
        const convList = await getAreaConversations(selectedAreaId);
        setConversations(convList);
      }
    } catch (err: any) {
      showAlert(err.message || "Error deleting chat", "Delete Chat Error");
    }
  };

  const handleRenameConversation = async (id: string, newTitle: string) => {
    try {
      await updateConversationTitle(id, newTitle);
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    } catch (err: any) {
      showAlert(err.message || "Error renaming conversation", "Rename Chat Error");
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
      showAlert(err.message || "Error deleting document", "Delete Document Error");
    }
  };

  // Mapear historial relacional al formato de assistant-ui
  const initialMessages = useMemo<ThreadMessageLike[]>(() => {
    return messages.map((m): ThreadMessageLike => {
      const sources: SourceInfo[] = m.sources_json ? JSON.parse(m.sources_json) : [];
      const usage = m.input_tokens > 0 ? {
        input_tokens: m.input_tokens,
        output_tokens: m.output_tokens,
        cost_usd: m.cost_usd,
        model: m.model_used || ''
      } : undefined;
      return {
        id: m.id.toString(),
        role: m.role as 'user' | 'assistant',
        content: [{ type: 'text', text: m.content }],
        ...(m.role === 'assistant' ? { 
          custom: { sources, usage },
          metadata: { custom: { sources, usage } }
        } : {})
      };
    });
  }, [messages]);


  // Obtener el nombre del área activa para mostrar en el header de móvil
  const activeAreaName = useMemo(() => {
    return areas.find(a => a.id === selectedAreaId)?.name || '';
  }, [areas, selectedAreaId]);

  const activeConversationTitle = useMemo(() => {
    return conversations.find(c => c.id === selectedConversationId)?.title || '';
  }, [conversations, selectedConversationId]);

  if (isInitialLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-bg select-none transition-colors duration-300">
        {/* Ambient background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--brand-shadow)_0%,transparent_65%)] pointer-events-none opacity-70 animate-pulse" />
        
        <div className="relative flex flex-col items-center gap-6 z-10">
          {/* Logo container with floating/pulse effect */}
          <div className="relative p-4 rounded-3xl bg-brand-primary/10 border border-brand-primary/20 shadow-[0_0_40px_var(--brand-shadow)] animate-pulse">
            <BrainCircuit className="h-12 w-12 text-brand-primary" />
            <div className="absolute -inset-0.5 bg-brand-primary/20 rounded-3xl blur opacity-30 animate-pulse" />
          </div>
          
          <div className="flex flex-col items-center text-center gap-2">
            <h1 className="text-3xl font-extrabold text-brand-text tracking-tight flex items-center gap-2">
              My Brain <span className="text-brand-primary font-mono text-sm uppercase bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/30">LM</span>
            </h1>
            <p className="text-sm text-brand-secondary max-w-xs font-medium tracking-wide">
              Loading your workspace...
            </p>
          </div>
          
          {/* Progress bar loader */}
          <div className="w-48 h-1.5 bg-zinc-900/60 rounded-full overflow-hidden border border-brand-border relative">
            <div className="h-full w-2/5 bg-gradient-to-r from-brand-primary/80 to-brand-primary rounded-full animate-loader absolute top-0 bottom-0" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-dvh flex overflow-hidden bg-brand-bg font-sans antialiased text-brand-text relative">
      {/* Backdrop para móvil */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-35 bg-black/80 md:hidden"
        />
      )}

      {/* Sidebar Split Panel (Burbujas + Listado) */}
      <Sidebar
        isOpen={isSidebarOpen}
        theme={theme}
        onThemeToggle={toggleTheme}
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
        {/* Header móvil */}
        <header className="flex md:hidden h-14 border-b border-brand-border bg-zinc-950/20 backdrop-blur-md items-center px-4 justify-between shrink-0 z-20">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 cursor-pointer"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-xs font-bold text-zinc-200 truncate px-2">
            {activeAreaName || 'My Brain LM'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 cursor-pointer"
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setIsViewingBrainStatus(true)}
              className="p-2 -mr-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 cursor-pointer"
              title="Brain Status"
            >
              <BrainCircuit className="h-4 w-4 text-brand-primary animate-pulse" />
            </button>
          </div>
        </header>

        {selectedAreaId ? (
          isLoadingMessages ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
              <div className="h-6 w-6 rounded-full border-2 border-brand-primary border-t-transparent animate-spin mb-2" />
              <p className="text-xs">Loading message history...</p>
            </div>
          ) : (
            <ChatContainer 
              chatId={selectedConversationId} 
              areaId={selectedAreaId}
              conversationTitle={activeConversationTitle}
              initialMessages={selectedConversationId ? initialMessages : []} 
              onConversationCreated={async (newConvId) => {
                // 1. Guardar que saltaremos el fetch automático al cambiar de URL
                skipMessageFetchRef.current = newConvId;

                // 2. Inicializar el estado de mensajes como vacío para este nuevo chat
                setMessages([]);

                // 3. Cambiar la URL de inmediato para evitar bloqueos de red
                navigate(`/areas/${selectedAreaId}/chats/${newConvId}`, { replace: true });

                // 4. Actualizar la barra lateral en segundo plano de manera asíncrona
                try {
                  const convList = await getAreaConversations(selectedAreaId);
                  setConversations(convList);
                } catch (err) {
                  console.error("Error updating conversations list in background:", err);
                }
              }}
              onConversationTitleUpdated={handleConversationTitleUpdated} 
            />
          )
        ) : (
          // Empty State / Welcome Screen
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 select-none animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 shadow-[0_0_20px_var(--brand-shadow)] mb-5">
              <Bot className="h-10 w-10 text-brand-primary animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              My Brain <span className="text-brand-primary font-mono text-sm uppercase bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/30">LM</span>
            </h2>
            
            <p className="text-sm font-medium text-brand-primary/80 mt-1.5 italic tracking-wide">
              "your docs, your local intelligence"
            </p>
            <p className="text-xs text-zinc-550 mt-3 max-w-sm leading-relaxed">
              Create your first knowledge area (e.g., "Code", "Studies", "Finance") to start organizing and ingesting documents.
            </p>
            <button
              onClick={() => setIsCreatingArea(true)}
              className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-zinc-950 font-bold hover:bg-brand-primary-hover shadow-[0_0_15px_var(--brand-shadow)] transition-all cursor-pointer text-xs"
            >
              <Plus className="h-4 w-4" /> Create Knowledge Area
            </button>
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
      <Modal
        isOpen={isViewingBrainStatus}
        onClose={() => setIsViewingBrainStatus(false)}
        size="lg"
      >
        <StatusPanel
          status={status}
          loading={loadingStatus}
          error={statusError}
          onRefresh={refreshStatus}
        />
      </Modal>
    </div>
  );
}

export default function App() {
  return (
    <AlertDialogProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainApp />} />
          <Route path="/areas/:areaId" element={<MainApp />} />
          <Route path="/areas/:areaId/chats/:chatId" element={<MainApp />} />
        </Routes>
      </Router>
    </AlertDialogProvider>
  );
}
