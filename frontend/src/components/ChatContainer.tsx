import React, { useMemo } from 'react';
import { 
  useLocalRuntime, 
  AssistantRuntimeProvider, 
  type ChatModelAdapter, 
  type ThreadMessageLike 
} from '@assistant-ui/react';
import { ChatArea } from './ChatArea';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface ChatContainerProps {
  chatId: number;
  initialMessages: ThreadMessageLike[];
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ chatId, initialMessages }) => {
  // Configurar el modelAdapter específicamente atado a este chatId
  const modelAdapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const lastMessage = messages[messages.length - 1];
      const userQuestion = lastMessage.content
        .filter((c) => c.type === 'text')
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('\n');

      const response = await fetch(`${API_BASE_URL}/api/chat/conversations/${chatId}/stream`, {
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
  }), [chatId]);

  // useLocalRuntime se ejecutará de cero porque el componente se remonta cuando cambia el key (chatId)
  const runtime = useLocalRuntime(modelAdapter, { initialMessages });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatArea />
    </AssistantRuntimeProvider>
  );
};
