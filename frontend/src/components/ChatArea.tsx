import React, { useState } from 'react';
import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  AuiIf,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, StopCircle, Bot, User, Sparkles, FileText, ChevronRight } from 'lucide-react';
import type { SourceInfo } from '../types';

export const ChatArea: React.FC = () => {
  return (
    <div className="flex-1 h-full bg-[#0d121f] flex flex-col min-w-0 relative">
      <ThreadPrimitive.Root className="flex flex-col h-full w-full">
        {/* Scrollable Viewport */}
        <ThreadPrimitive.Viewport
          turnAnchor="top"
          className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 scrollbar-thin scroll-smooth"
        >
          {/* Empty State / Welcome Screen */}
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 select-none animate-fade-in">
              <div className="p-3.5 rounded-2xl bg-violet-600/10 border border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.15)] mb-5">
                <Bot className="h-10 w-10 text-violet-400 animate-pulse" />
              </div>
              <h2 className="text-xl font-semibold text-slate-100 tracking-tight">
                ¡Hola! Soy tu asistente MyBrain
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-sm">
                Hazme cualquier pregunta sobre los documentos que has cargado en tu cerebro. Priorizaré esa información.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mt-8 w-full text-left">
                <div className="bg-slate-900/30 border border-slate-800/60 p-4 rounded-xl hover:border-slate-700/80 transition-colors">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                    Búsqueda Híbrida
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Combino similitud semántica y palabras clave para darte respuestas exactas.
                  </p>
                </div>
                <div className="bg-slate-900/30 border border-slate-800/60 p-4 rounded-xl hover:border-slate-700/80 transition-colors">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-violet-400" />
                    Referencias Claras
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Cada respuesta indica los archivos fuente y puntuación de relevancia del vector store.
                  </p>
                </div>
              </div>
            </div>
          </AuiIf>

          {/* Messages List */}
          <ThreadPrimitive.Messages>
            {({ message }) => {
              if (message.role === 'user') {
                return <UserMessage />;
              }
              
              // Extract sources from custom message custom field
              const custom = (message as any).custom as { sources?: SourceInfo[] } | undefined;
              const sources = custom?.sources || [];
              return <AssistantMessage sources={sources} />;
            }}
          </ThreadPrimitive.Messages>

          {/* Spacer to guarantee scroll bottom space */}
          <div className="h-2" />
        </ThreadPrimitive.Viewport>

        {/* Viewport Footer with Composer */}
        <ThreadPrimitive.ViewportFooter className="px-4 pb-6 md:px-8 bg-gradient-to-t from-[#0d121f] via-[#0d121f]/90 to-transparent pt-4">
          <ComposerPrimitive.Root className="max-w-3xl mx-auto flex items-end gap-3 bg-slate-950/40 backdrop-blur border border-slate-850 focus-within:border-slate-700 rounded-2xl p-2.5 transition-all shadow-lg">
            <ComposerPrimitive.Input
              placeholder="Haz una pregunta sobre tus documentos..."
              className="flex-1 min-h-[44px] max-h-36 resize-none bg-transparent px-3 py-2 text-sm text-slate-100 focus:outline-none placeholder-slate-500 scrollbar-none"
              rows={1}
            />
            
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors">
                <StopCircle className="h-4 w-4" />
              </ComposerPrimitive.Cancel>
            </AuiIf>
            
            <AuiIf condition={(s) => !s.thread.isRunning}>
              <ComposerPrimitive.Send className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-slate-100 hover:bg-violet-500 disabled:opacity-25 disabled:hover:bg-violet-600 transition-all shadow-[0_0_10px_rgba(139,92,246,0.25)]">
                <ArrowUp className="h-4 w-4" />
              </ComposerPrimitive.Send>
            </AuiIf>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Root>
    </div>
  );
};

// User Message component
const UserMessage: React.FC = () => {
  return (
    <div className="flex justify-end w-full max-w-3xl mx-auto animate-fade-in">
      <div className="flex gap-3 max-w-[85%]">
        <div className="flex flex-col items-end">
          <div className="rounded-2xl rounded-tr-none bg-violet-600/10 border border-violet-500/20 text-slate-100 px-4 py-3 text-sm shadow-md leading-relaxed">
            <MessagePrimitive.Content />
          </div>
          <span className="text-[10px] text-slate-500 mt-1.5 mr-1 font-medium uppercase tracking-wider">
            Tú
          </span>
        </div>
        <div className="h-7 w-7 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 shadow-sm mt-1">
          <User className="h-4 w-4 text-violet-400" />
        </div>
      </div>
    </div>
  );
};

// Assistant Message component
interface AssistantMessageProps {
  sources: SourceInfo[];
}

const AssistantMessage: React.FC<AssistantMessageProps> = ({ sources }) => {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <div className="flex justify-start w-full max-w-3xl mx-auto animate-fade-in">
      <div className="flex gap-3 max-w-[85%]">
        <div className="h-7 w-7 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm mt-1">
          <Bot className="h-4 w-4 text-emerald-400" />
        </div>
        
        <div className="flex-1 flex flex-col items-start min-w-0">
          <div className="rounded-2xl rounded-tl-none bg-slate-900/30 border border-slate-800/40 text-slate-200 px-4 py-3 text-sm shadow-sm leading-relaxed w-full">
            {/* Using MarkdownTextPrimitive component from @assistant-ui/react-markdown */}
            <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed prose-p:my-2 prose-pre:bg-slate-950/70 prose-pre:border prose-pre:border-slate-850 prose-code:text-violet-300 prose-code:bg-slate-900/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
              <MarkdownTextPrimitive remarkPlugins={[remarkGfm]} />
            </div>

            {/* RAG Sources Rendering */}
            {sources.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-slate-800/50">
                <button
                  onClick={() => setSourcesOpen(!sourcesOpen)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium focus:outline-none"
                >
                  <Sparkles className="h-3 w-3 text-violet-400" />
                  <span>Fuentes utilizadas ({sources.length})</span>
                  <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${sourcesOpen ? 'rotate-90 text-slate-400' : 'text-slate-600'}`} />
                </button>

                {sourcesOpen && (
                  <div className="flex flex-col gap-1.5 mt-2.5 animate-slide-down">
                    {sources.map((src, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-950/30 border border-slate-900 text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-950/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="font-mono truncate">{src.source}</span>
                          <span className="text-[10px] text-slate-600">
                            (Chunk {src.chunk_index})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            src.relevance_score > 0.8
                              ? 'bg-emerald-950/20 border border-emerald-900/50 text-emerald-400'
                              : src.relevance_score > 0.5
                              ? 'bg-amber-950/20 border border-amber-900/50 text-amber-400'
                              : 'bg-slate-900 border border-slate-800 text-slate-500'
                          }`}>
                            {(src.relevance_score * 100).toFixed(0)}% de confianza
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <span className="text-[10px] text-slate-500 mt-1.5 ml-1 font-medium uppercase tracking-wider">
            MyBrain
          </span>
        </div>
      </div>
    </div>
  );
};
