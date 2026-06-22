import React, { useMemo, useRef } from 'react';
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
  initialMessages: ThreadMessageLike[];
  onConversationCreated?: (newConvId: string) => void;
  onConversationTitleUpdated?: (convId: string, newTitle: string) => void;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ 
  chatId, 
  areaId,
  initialMessages,
  onConversationCreated,
  onConversationTitleUpdated
}) => {
  // Guardar refs de chatId y callbacks para evitar recrear el adapter ante cambios de props
  const activeChatIdRef = useRef<string | null>(chatId);
  const onConversationCreatedRef = useRef(onConversationCreated);
  onConversationCreatedRef.current = onConversationCreated;
  
  const onConversationTitleUpdatedRef = useRef(onConversationTitleUpdated);
  onConversationTitleUpdatedRef.current = onConversationTitleUpdated;

  // Configurar el modelAdapter específicamente atado a este chatId o el draft actual
  const modelAdapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const lastMessage = messages[messages.length - 1];
      const userQuestion = lastMessage.content
        .filter((c) => c.type === 'text')
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('\n');

      let activeId = activeChatIdRef.current;
      
      // Si es una conversación draft (lazy), la creamos ahora en el backend antes de la consulta
      if (!activeId) {
        if (!areaId) {
          throw new Error('Area ID is required to create a conversation');
        }
        try {
          const newConv = await createConversation(areaId);
          activeId = newConv.id;
          activeChatIdRef.current = activeId;
        } catch (err: any) {
          console.error("Error creating conversation lazy:", err);
          throw new Error(err.message || 'Error creating conversation');
        }
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
                  yield {
                    content: [{ type: 'text' as const, text }],
                    custom: { sources, agentStatus: null },
                    metadata: {
                      custom: { sources, agentStatus: null }
                    }
                  };
                  if (data.title && onConversationTitleUpdatedRef.current && activeId) {
                    onConversationTitleUpdatedRef.current(activeId, data.title);
                  }
                } else if (data.error) {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.error("Error al decodificar SSE JSON:", e);
              }
            }
          }
        }
        
        // Al terminar con éxito la transmisión del primer mensaje, notificamos la creación de la conversación
        // para que el padre actualice la URL y el sidebar sin interrumpir el flujo visual.
        if (chatId === null && activeId && onConversationCreatedRef.current) {
          onConversationCreatedRef.current(activeId);
        }
      } finally {
        reader.releaseLock();
      }
    },
  }), [areaId, chatId]);

  // useLocalRuntime se ejecutará de cero porque el componente se remonta cuando cambia el key (chatId)
  const runtime = useLocalRuntime(modelAdapter, { initialMessages });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatArea />
    </AssistantRuntimeProvider>
  );
};
