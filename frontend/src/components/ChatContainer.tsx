import React, { useMemo, useRef, useEffect } from 'react';
import { 
  useLocalRuntime, 
  AssistantRuntimeProvider, 
  type ChatModelAdapter, 
  type ThreadMessageLike 
} from '@assistant-ui/react';
import { ChatArea } from './ChatArea';
import { createConversation } from '../api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface ChatContainerProps {
  chatId: string | null;
  areaId?: string;
  conversationTitle?: string;
  initialMessages: ThreadMessageLike[];
  onConversationCreated?: (newConvId: string) => void;
  onConversationTitleUpdated?: (convId: string, newTitle: string) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ 
  chatId, 
  areaId,
  conversationTitle,
  initialMessages,
  onConversationCreated,
  onConversationTitleUpdated
}) => {
  // Guardar refs de callbacks para evitar recrear el adapter ante cambios de props
  const onConversationCreatedRef = useRef(onConversationCreated);
  onConversationCreatedRef.current = onConversationCreated;
  
  const onConversationTitleUpdatedRef = useRef(onConversationTitleUpdated);
  onConversationTitleUpdatedRef.current = onConversationTitleUpdated;

  // Guardar refs de chatId y areaId para evitar recrear el adapter y por ende el runtime
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  const areaIdRef = useRef(areaId);
  areaIdRef.current = areaId;

  const transitioningChatIdRef = useRef<string | null>(null);

  // Configurar el modelAdapter específicamente atado a este chatId o el draft actual
  const modelAdapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const lastMessage = messages[messages.length - 1];
      const userQuestion = lastMessage.content
        .filter((c) => c.type === 'text')
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('\n');

      let activeId: string;
      const currentChatId = chatIdRef.current;
      const currentAreaId = areaIdRef.current;

      // Si es una conversación borrador (draft), la creamos e iniciamos la transición
      if (!currentChatId) {
        if (!currentAreaId) {
          throw new Error('Area ID is required to create a conversation');
        }
        try {
          const newConv = await createConversation(currentAreaId);
          activeId = newConv.id;
          transitioningChatIdRef.current = newConv.id;
          if (onConversationCreatedRef.current) {
            onConversationCreatedRef.current(newConv.id);
          }
        } catch (err: any) {
          console.error("Error creating conversation lazy:", err);
          throw new Error(err.message || 'Error creating conversation');
        }
      } else {
        activeId = currentChatId;
      }

      const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${activeId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion, top_k: 5 }),
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Could not open response stream.');
      }

      const decoder = new TextDecoder('utf-8');
      let text = '';
      let sources: any[] = [];
      let currentStatus = '';

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
                
                if (data.status) {
                  currentStatus = data.status;
                  yield {
                    content: [{ type: 'text' as const, text: '' }],
                    custom: { agentStatus: currentStatus },
                    metadata: {
                      custom: { agentStatus: currentStatus }
                    }
                  };
                } else if (data.token) {
                  text += data.token;
                  yield {
                    content: [{ type: 'text' as const, text }],
                    custom: { agentStatus: null },
                    metadata: {
                      custom: { agentStatus: null }
                    }
                  };
                } else if (data.done) {
                  sources = data.sources || [];
                  const usage = data.usage || null;
                  yield {
                    content: [{ type: 'text' as const, text }],
                    custom: { sources, usage, agentStatus: null },
                    metadata: {
                      custom: { sources, usage, agentStatus: null }
                    }
                  };
                  if (data.title && onConversationTitleUpdatedRef.current && activeId) {
                    onConversationTitleUpdatedRef.current(activeId, data.title);
                  }
                } else if (data.error) {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error("Error decoding SSE JSON:", e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  }), []);

  const runtime = useLocalRuntime(modelAdapter, { initialMessages });

  const prevChatIdRef = useRef<string | null>(chatId);

  // Sincronizar initialMessages cuando cambian (ej. al cambiar de chat o al reiniciar el borrador)
  useEffect(() => {
    const prevChatId = prevChatIdRef.current;
    prevChatIdRef.current = chatId;

    // Solo nos interesa resetear si el chatId cambió
    if (prevChatId !== chatId) {
      // Si el cambio de chatId es la transición esperada del borrador al chat recién creado,
      // evitamos el reset para que no se interrumpa el stream en progreso
      if (prevChatId === null && chatId === transitioningChatIdRef.current) {
        // Limpiar el ref de transición ya que se ha completado la navegación
        transitioningChatIdRef.current = null;
        return;
      }

      // En cualquier otro caso de cambio de chatId, reseteamos el thread con los nuevos mensajes
      runtime.thread.reset(initialMessages);
    }
  }, [chatId, initialMessages, runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatArea conversationTitle={conversationTitle} />
    </AssistantRuntimeProvider>
  );
};
