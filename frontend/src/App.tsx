import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalRuntime, type ChatModelAdapter, AssistantRuntimeProvider } from '@assistant-ui/react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { getStatus } from './api';
import type { StatusResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

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

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Memoize model adapter to prevent runtime re-initializations
  const modelAdapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const lastMessage = messages[messages.length - 1];
      const userQuestion = lastMessage.content
        .filter((c) => c.type === 'text')
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('\n');

      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion, top_k: 5 }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`Error en la API: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No se pudo abrir el stream de respuesta.');
      }

      const decoder = new TextDecoder('utf-8');
      let text = '';
      let sources: any[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);
                if (data.token) {
                  text += data.token;
                  yield {
                    content: [{ type: 'text' as const, text }],
                  };
                } else if (data.done) {
                  sources = data.sources || [];
                  yield {
                    content: [{ type: 'text' as const, text }],
                    custom: { sources },
                  };
                } else if (data.error) {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error("Error al decodificar SSE JSON:", e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  }), []);

  const runtime = useLocalRuntime(modelAdapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="w-screen h-screen flex overflow-hidden bg-[#0a0e17] font-sans antialiased text-slate-200">
        <Sidebar
          status={status}
          loading={loadingStatus}
          error={statusError}
          onRefresh={refreshStatus}
        />
        <ChatArea />
      </div>
    </AssistantRuntimeProvider>
  );
}
