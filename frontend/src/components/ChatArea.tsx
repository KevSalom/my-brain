import React, { useState, useEffect } from 'react';
import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  AuiIf,
  useAuiState,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, StopCircle, FileText, ChevronRight, Copy, Check, BrainCircuit } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { SourceInfo, ModelInfo } from '../types';
import { getModelInfo } from '../api';

const CodeBlockWithCopy: React.FC<{
  language: string;
  value: string;
}> = ({ language, value }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="relative group rounded-xl my-3 border border-zinc-800 bg-[#09090b] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-850 bg-zinc-950/40 text-xs text-zinc-500 font-mono select-none">
        <span className="uppercase">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer font-sans"
        >
          {isCopied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code contents */}
      <SyntaxHighlighter
        style={vscDarkPlus as any}
        language={language}
        PreTag="div"
        customStyle={{
          background: 'transparent',
          margin: 0,
          padding: '16px',
          fontSize: '12px',
          lineHeight: '1.6',
          overflowX: 'auto',
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const CopyButton: React.FC<{ value: string; className?: string }> = ({ value, className = '' }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`transition-colors duration-200 p-1 text-zinc-500 hover:text-zinc-300 cursor-pointer ${className}`}
      title="Copy to clipboard"
    >
      {isCopied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
};

const ContextMeterHeader: React.FC<{ conversationTitle?: string }> = ({ conversationTitle }) => {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const messages = useAuiState((s) => s.thread.messages);

  useEffect(() => {
    getModelInfo()
      .then(setModelInfo)
      .catch((err) => console.error("Error fetching model info:", err));
  }, []);

  if (!modelInfo) {
    return (
      <div className="w-full border-b border-brand-border bg-zinc-950/20 backdrop-blur-sm px-4 py-2 flex items-center justify-between text-xs shrink-0 select-none h-[33px]">
        <div className="flex items-center gap-1.5 font-medium text-zinc-400">
          <span className="truncate max-w-[180px] md:max-w-[300px]">
            {conversationTitle || "New Conversation"}
          </span>
        </div>
      </div>
    );
  }

  // Encontrar el último mensaje del asistente con usage
  let activeUsage = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as any;
    const custom = (m.custom || m.metadata?.custom) as any;
    if (custom?.usage) {
      activeUsage = custom.usage;
      break;
    }
  }

  const inputTokens = activeUsage?.input_tokens || 0;
  const contextLength = modelInfo.context_length || 128000;
  const percentage = Math.min(100, (inputTokens / contextLength) * 100);

  // Determinar color de barra
  let barColorClass = "bg-zinc-650";
  let textColorClass = "text-zinc-300";
  if (percentage >= 80) {
    barColorClass = "bg-rose-500";
    textColorClass = "text-rose-400";
  } else if (percentage >= 50) {
    barColorClass = "bg-amber-500";
    textColorClass = "text-amber-400";
  }

  return (
    <div className="w-full border-b border-brand-border bg-zinc-950/20 backdrop-blur-sm px-4 py-2 flex items-center justify-between text-xs shrink-0 select-none h-[33px]">
      <div className="flex items-center gap-1.5 font-medium text-zinc-400">
        <span className="truncate max-w-[180px] md:max-w-[300px]">
          {conversationTitle || "New Conversation"}
        </span>
      </div>
      
      {inputTokens > 0 && (
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-zinc-500">
            Context: <span className={`${textColorClass} font-semibold`}>{inputTokens.toLocaleString()}</span> / {contextLength >= 1000000 ? `${contextLength / 1000000}M` : `${contextLength / 1000}K`}
          </span>
          <div className="w-20 md:w-28 h-1.5 bg-zinc-900/60 rounded-full overflow-hidden border border-brand-border relative">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${barColorClass}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};


interface ChatAreaProps {
  conversationTitle?: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ conversationTitle }) => {
  return (
    <div className="flex-1 min-h-0 bg-brand-bg flex flex-col min-w-0 relative">
      <ThreadPrimitive.Root className="flex flex-col h-full w-full">
        {/* Context Meter Header */}
        <ContextMeterHeader conversationTitle={conversationTitle} />

        {/* Scrollable Viewport */}
        <ThreadPrimitive.Viewport
          autoScroll={true}
          className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 scrollbar-thin scroll-smooth"
        >
          {/* Empty State / Welcome Screen */}
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <div className="h-[calc(100%-3rem)] flex flex-col items-center justify-center text-center max-w-md mx-auto py-8 md:py-16 select-none animate-fade-in">
              {/* Icon Container with ambient glow */}
              <div className="relative p-4 rounded-3xl bg-brand-primary/5 border border-brand-border shadow-[0_0_30px_rgba(245,158,11,0.03)] mb-6 transition-all duration-350 hover:border-brand-primary/20 hover:shadow-[0_0_40px_rgba(245,158,11,0.06)] group">
                <BrainCircuit className="h-9 w-9 text-brand-primary animate-pulse relative z-10" />
                <div className="absolute inset-0 bg-brand-primary/10 rounded-3xl blur-md opacity-20 group-hover:opacity-40 transition-opacity duration-300" />
              </div>

              {/* Status Header */}
              <span className="text-[10px] font-semibold text-brand-primary uppercase tracking-[0.25em] mb-3 select-none opacity-80 animate-pulse">
                Brain Active
              </span>

              {/* Main Message with typographic hierarchy and lighter tones */}
              <h2 className="text-xl md:text-2xl font-light text-zinc-400 max-w-sm leading-relaxed tracking-tight px-4">
                Ask me anything about the{" "}
                <span className="text-zinc-100 font-medium border-b border-zinc-800 dark:border-zinc-800/80 pb-0.5">documents</span> you have
                loaded in your{" "}
                <span className="text-zinc-100 font-medium">brain area...</span>
              </h2>
            </div>
          </AuiIf>
 
          {/* Messages List */}
          <ThreadPrimitive.Messages>
            {({ message }) => {
              if (message.role === 'user') {
                return <UserMessage message={message} />;
              }
              
              // Extract sources, usage and status from custom message custom field (check both root and metadata.custom)
              const custom = ((message as any).custom || (message as any).metadata?.custom) as { sources?: SourceInfo[], usage?: any, agentStatus?: string } | undefined;
              const sources = custom?.sources || [];
              const usage = custom?.usage || null;
              const agentStatus = custom?.agentStatus || '';
              return <AssistantMessage message={message} sources={sources} usage={usage} agentStatus={agentStatus} />;
            }}
          </ThreadPrimitive.Messages>
 
          {/* Spacer to guarantee scroll bottom space */}
          <div className="h-2" />
        </ThreadPrimitive.Viewport>
 
        {/* Viewport Footer with Composer */}
        <ThreadPrimitive.ViewportFooter className="px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-8 bg-gradient-to-t from-brand-bg via-brand-bg/90 to-transparent pt-4">
          <ComposerPrimitive.Root className="max-w-3xl mx-auto flex items-end gap-3 bg-zinc-950/40 backdrop-blur border border-brand-border focus-within:border-brand-primary rounded-2xl p-2.5 transition-all shadow-lg">
            <ComposerPrimitive.Input
              placeholder="Ask a question about your documents..."
              className="flex-1 min-h-[44px] max-h-36 resize-none bg-transparent px-3 py-2 text-sm text-zinc-100 focus:outline-none placeholder-zinc-500 scrollbar-none"
              rows={1}
            />
            
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors">
                <StopCircle className="h-4 w-4" />
              </ComposerPrimitive.Cancel>
            </AuiIf>
            
            <AuiIf condition={(s) => !s.thread.isRunning}>
              <ComposerPrimitive.Send className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-zinc-950 hover:bg-brand-primary-hover disabled:opacity-25 disabled:hover:bg-brand-primary transition-all shadow-[0_0_10px_var(--brand-shadow)]">
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
const UserMessage: React.FC<{ message: any }> = ({ message }) => {
  const textValue = message.content
    ? message.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => (c.type === 'text' ? c.text : ''))
        .join('\n')
    : '';

  return (
    <MessagePrimitive.Root className="flex justify-end w-full max-w-3xl mx-auto animate-fade-in group">
      <div className="flex flex-col items-end max-w-[85%]">
        {/* Message bubble */}
        <div className="rounded-2xl rounded-tr-none bg-brand-primary/10 border border-brand-primary/20 text-zinc-100 px-4 py-3 text-sm shadow-md leading-relaxed hover:border-brand-primary/30 transition-all duration-300">
          <MessagePrimitive.Content />
        </div>
        
        {/* Copy Button (below and to the right) */}
        <CopyButton value={textValue} className="mt-1.5" />
      </div>
    </MessagePrimitive.Root>
  );
};

// Assistant Message component
interface AssistantMessageProps {
  message: any;
  sources: SourceInfo[];
  usage?: any;
  agentStatus?: string;
}

const AssistantMessage: React.FC<AssistantMessageProps> = ({ message, sources, usage, agentStatus }) => {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isLast = useAuiState((s) => s.thread.messages.at(-1)?.id === message.id);
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const showActions = !isRunning || !isLast;

  // Determinar si el mensaje no tiene contenido de texto real (vacío o solo espacios)
  const isTextEmpty = !message.content || message.content.every((part: any) => {
    return part.type === 'text' && (!part.text || !part.text.trim());
  });

  // Si está vacío, solo lo mostramos si el hilo está activo y es el último mensaje
  if (isTextEmpty) {
    if (!isRunning || !isLast) {
      return null;
    }
  }

  const textValue = message.content
    ? message.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => (c.type === 'text' ? c.text : ''))
        .join('\n')
    : '';

  return (
    <MessagePrimitive.Root className="flex justify-start w-full max-w-3xl mx-auto animate-fade-in group">
      <div className="flex flex-col items-start min-w-0 w-full">
        <div className="text-zinc-200 text-sm leading-relaxed w-full">
          {agentStatus ? (
            <div className="py-1 flex items-center gap-2 text-zinc-400 font-medium select-none animate-pulse">
              <BrainCircuit className="h-3.5 w-3.5 text-brand-primary" />
              <span className="text-xs tracking-wide">{agentStatus}</span>
            </div>
          ) : (
            <>
              {/* Using MarkdownTextPrimitive component from @assistant-ui/react-markdown */}
              <div className="prose prose-invert max-w-none text-zinc-200 text-sm leading-relaxed prose-p:my-2 prose-pre:bg-zinc-950/70 prose-pre:border prose-pre:border-brand-border prose-code:text-brand-primary prose-code:bg-zinc-900/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                <MessagePrimitive.Parts>
                  {({ part }) => part.type === "text" ? (
                    <MarkdownTextPrimitive 
                      remarkPlugins={[remarkGfm]} 
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const { ref, ...rest } = props as any;
                          const codeString = String(children).replace(/\n$/, '');
                          return match ? (
                            <CodeBlockWithCopy
                              language={match[1]}
                              value={codeString}
                              {...rest}
                            />
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        }
                      }}
                    />
                  ) : null}
                </MessagePrimitive.Parts>
              </div>

              {/* Footer Actions Row */}
              {showActions && (
                <div className={`flex items-center gap-3 mt-3 w-full ${sources.length > 0 || usage ? 'pt-2.5 border-t border-zinc-800/40' : ''}`}>
                  <CopyButton value={textValue} />
                  
                  {sources.length > 0 && (
                    <>
                      <span className="h-3 w-px bg-zinc-800/80" />
                      <button
                        onClick={() => setSourcesOpen(!sourcesOpen)}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium focus:outline-none cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <span>Sources used ({sources.length})</span>
                        <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${sourcesOpen ? 'rotate-90 text-zinc-400' : 'text-zinc-600'}`} />
                      </button>
                    </>
                  )}

                  {usage && (
                    <>
                      <span className="h-3 w-px bg-zinc-800/80" />
                      <div className="group/tooltip relative flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-help font-medium">
                        <BrainCircuit className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <span>
                          {(usage.input_tokens + usage.output_tokens).toLocaleString()} tokens
                          {usage.cost_usd > 0 && ` · $${usage.cost_usd.toFixed(4)}`}
                        </span>
                        
                        {/* Tooltip with breakdown */}
                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover/tooltip:block z-30 bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg shadow-xl font-mono text-[10px] text-zinc-400 space-y-1 w-48">
                          <div className="text-zinc-300 border-b border-zinc-800 pb-1 mb-1 font-bold">Token Breakdown</div>
                          <div className="flex justify-between">
                            <span>Input (Prompt):</span>
                            <span className="text-zinc-200">{usage.input_tokens.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Output (Gen):</span>
                            <span className="text-zinc-200">{usage.output_tokens.toLocaleString()}</span>
                          </div>
                          {usage.cost_usd > 0 && (
                            <div className="flex justify-between border-t border-zinc-850 pt-1 mt-1 font-bold">
                              <span>Cost (USD):</span>
                              <span className="text-brand-primary">${usage.cost_usd.toFixed(6)}</span>
                            </div>
                          )}
                          <div className="text-[9px] text-zinc-550 truncate border-t border-zinc-850 pt-1 mt-1">
                            Model: {usage.model}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* RAG Sources List */}
              {sources.length > 0 && sourcesOpen && (
                <div className="flex flex-col gap-1.5 mt-2.5 animate-slide-down w-full">
                  {(() => {
                    const maxScore = sources[0]?.relevance_score || 0;
                    return sources.map((src, i) => {
                      const ratio = maxScore > 0 ? (src.relevance_score / maxScore) : 0;
                      
                      let label = "Additional Context";
                      let badgeClass = "bg-relevance-low-bg border border-relevance-low-border text-relevance-low-text";
                      
                      if (ratio >= 0.85) {
                        label = "High Relevance";
                        badgeClass = "bg-relevance-high-bg border border-relevance-high-border text-relevance-high-text";
                      } else if (ratio >= 0.5) {
                        label = "Medium Relevance";
                        badgeClass = "bg-relevance-medium-bg border border-relevance-medium-border text-relevance-medium-text";
                      }
                      
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/30 border border-zinc-900 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-950/50 transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                            <span className="font-mono truncate">{src.source}</span>
                            <span className="text-xs text-zinc-600">
                              (Chunk {src.chunk_index})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold ${badgeClass}`}>
                              {label}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

