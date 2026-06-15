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
  getConversationMessages
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

  const selectedAreaId = areaId ? parseInt(areaId, 10) : null;
  const selectedConversationId = chatId ? parseInt(chatId, 10) : null;

  // --- Estados del Sistema ---
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // --- Estados de Áreas ---
  const [areas, setAreas] = useState<AreaResponse[]>([]);
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaDescription, setNewAreaDescription] = useState('');
  const [newAreaColor, setNewAreaColor] = useState('#3B82F6');

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
      setStatusError(err.message || 'Error de conexión con el backend.');
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
      console.error("Error al cargar áreas:", err);
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
      console.error("Error al refrescar recursos del área:", err);
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
      console.error("Error al cargar mensajes del hilo:", err);
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

  const handleCreateArea = async () => {
    if (!newAreaName.trim()) return;
    try {
      const created = await createArea(
        newAreaName.trim(),
        newAreaDescription.trim() || undefined,
        newAreaColor
      );
      setIsCreatingArea(false);
      setNewAreaName('');
      setNewAreaDescription('');
      setNewAreaColor('#3B82F6');
      
      // Refrescar y navegar al área recién creada
      await refreshAreas(false);
      navigate(`/areas/${created.id}`);
    } catch (err: any) {
      alert(err.message || "Error al crear área");
    }
  };

  const handleDeleteArea = async (id: number) => {
    try {
      await deleteArea(id);
      if (selectedAreaId === id) {
        navigate('/');
      }
      refreshAreas(true);
      refreshStatus();
    } catch (err: any) {
      alert(err.message || "Error al eliminar área");
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
      alert(err.message || "Error al crear conversación");
    }
  };

  const handleDeleteConversation = async (id: number) => {
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
      alert(err.message || "Error al eliminar chat");
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (selectedAreaId === null) return;
    try {
      await deleteAreaDocument(selectedAreaId, docId);
      const docsList = await getAreaDocuments(selectedAreaId);
      setDocuments(docsList);
      refreshStatus();
    } catch (err: any) {
      alert(err.message || "Error al eliminar documento");
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
        documents={documents}
        onDeleteDocument={handleDeleteDocument}
        onUploadSuccess={refreshAreaResources}
        status={status}
        loadingStatus={loadingStatus}
        statusError={statusError}
        refreshStatus={refreshStatus}
      />

      {/* Main Container */}
      <main className="flex-1 h-full flex flex-col min-w-0 bg-brand-bg relative">
        {selectedConversationId ? (
          isLoadingMessages ? (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
              <div className="h-6 w-6 rounded-full border-2 border-brand-primary border-t-transparent animate-spin mb-2" />
              <p className="text-xs">Cargando historial de mensajes...</p>
            </div>
          ) : (
            // El key en el ChatContainer fuerza a remontar y crear una runtime limpia
            <ChatContainer key={selectedConversationId} chatId={selectedConversationId} initialMessages={initialMessages} />
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
                  Estás en el área <span className="text-brand-primary font-bold">{activeAreaName}</span>.
                </p>
                <p className="text-xs text-zinc-505 mt-2 max-w-sm leading-relaxed">
                  Inicia un chat nuevo en esta área para empezar a hacer consultas sobre sus documentos locales.
                </p>
                <button
                  onClick={handleCreateConversation}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-zinc-950 font-bold hover:bg-brand-primary-hover shadow-[0_0_15px_var(--brand-shadow)] transition-all cursor-pointer text-xs"
                >
                  <MessageSquare className="h-4 w-4" /> Iniciar Primer Chat
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-brand-primary/80 mt-1.5 italic tracking-wide">
                  "your docs, your local intelligence"
                </p>
                <p className="text-xs text-zinc-505 mt-3 max-w-sm leading-relaxed">
                  Crea tu primera área temática en el panel izquierdo (ej: "Código", "Estudios", "Finanzas") para empezar a ingestar documentos de forma organizada.
                </p>
                <button
                  onClick={() => setIsCreatingArea(true)}
                  className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-primary text-zinc-950 font-bold hover:bg-brand-primary-hover shadow-[0_0_15px_var(--brand-shadow)] transition-all cursor-pointer text-xs"
                >
                  <Plus className="h-4 w-4" /> Crear Área de Conocimiento
                </button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Modal para Crear Área */}
      {isCreatingArea && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-brand-border rounded-2xl w-full max-w-sm p-5 shadow-2xl animate-fade-in">
            <h3 className="text-sm font-bold text-zinc-150 mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-brand-primary" /> Crear Área de Conocimiento
            </h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider block mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="w-full bg-zinc-950/60 border border-zinc-800/80 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                  placeholder="ej. Inteligencia Artificial, Finanzas, Salud..."
                />
              </div>
              
              <div>
                <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider block mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={newAreaDescription}
                  onChange={(e) => setNewAreaDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-950/60 border border-zinc-800/80 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none resize-none"
                  placeholder="ej. Papers, tutoriales y apuntes sobre IA..."
                />
              </div>
              
              <div>
                <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider block mb-1">
                  Color Temático
                </label>
                <div className="flex gap-2.5 mt-1.5 justify-between">
                  {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewAreaColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-6.5 h-6.5 rounded-full border-2 transition-transform duration-200 cursor-pointer ${
                        newAreaColor === color ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6">
              <button
                onClick={() => {
                  setIsCreatingArea(false);
                  setNewAreaName('');
                  setNewAreaDescription('');
                  setNewAreaColor('#3B82F6');
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateArea}
                disabled={!newAreaName.trim()}
                className="px-3.5 py-1.5 rounded-lg text-xs bg-brand-primary text-zinc-950 font-bold hover:bg-brand-primary-hover disabled:opacity-25 transition-all shadow-[0_0_10px_var(--brand-shadow)] cursor-pointer"
              >
                Crear Área
              </button>
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
