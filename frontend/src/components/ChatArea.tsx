import React, { useState } from 'react';
import {
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  AuiIf,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, StopCircle, Bot, User, Sparkles, FileText, ChevronRight, Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { SourceInfo } from '../types';

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
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-850 bg-zinc-950/40 text-[10px] text-zinc-500 font-mono select-none">
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

export const ChatArea: React.FC = () => {
  return (
    <div className="flex-1 h-full bg-brand-bg flex flex-col min-w-0 relative">
      <ThreadPrimitive.Root className="flex flex-col h-full w-full">
        {/* Scrollable Viewport */}
        <ThreadPrimitive.Viewport
          autoScroll={true}
          className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6 scrollbar-thin scroll-smooth"
        >
          {/* Empty State / Welcome Screen */}
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 select-none animate-fade-in">
              <div className="p-3.5 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 shadow-[0_0_20px_var(--brand-shadow)] mb-5">
                <Bot className="h-10 w-10 text-brand-primary animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                My Brain <span className="text-brand-primary font-mono text-sm uppercase bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/30">LM</span>
              </h2>
              <p className="text-sm font-medium text-brand-primary/80 mt-1.5 italic tracking-wide">
                "your docs, your local intelligence"
              </p>
              <p className="text-xs text-zinc-400 mt-3 max-w-sm leading-relaxed">
                Ask me anything about the documents you have loaded in your brain. I will analyze the information locally.
              </p>

              <div className="grid grid-cols-2 gap-3 mt-8 w-full text-left">
                <div className="bg-zinc-900/10 border border-brand-border p-4 rounded-xl hover:border-brand-primary/30 transition-all duration-300">
                  <h4 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
                    Hybrid Search
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    I combine semantic similarity and keywords to give you exact answers.
                  </p>
                </div>
                <div className="bg-zinc-900/10 border border-brand-border p-4 rounded-xl hover:border-brand-primary/30 transition-all duration-300">
                  <h4 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-brand-primary" />
                    Clear References
                  </h4>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Each response indicates the source files and relevance score from the vector store.
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
              
              // Extract sources and status from custom message custom field (check both root and metadata.custom)
              const custom = ((message as any).custom || (message as any).metadata?.custom) as { sources?: SourceInfo[], agentStatus?: string } | undefined;
              const sources = custom?.sources || [];
              const agentStatus = custom?.agentStatus || '';
              return <AssistantMessage sources={sources} agentStatus={agentStatus} />;
            }}
          </ThreadPrimitive.Messages>
 
          {/* Spacer to guarantee scroll bottom space */}
          <div className="h-2" />
        </ThreadPrimitive.Viewport>
 
        {/* Viewport Footer with Composer */}
        <ThreadPrimitive.ViewportFooter className="px-4 pb-6 md:px-8 bg-gradient-to-t from-brand-bg via-brand-bg/90 to-transparent pt-4">
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
const UserMessage: React.FC = () => {
  return (
    <MessagePrimitive.Root className="flex justify-end w-full max-w-3xl mx-auto animate-fade-in">
      <div className="flex gap-3 max-w-[85%]">
        <div className="flex flex-col items-end">
          <div className="rounded-2xl rounded-tr-none bg-brand-primary/10 border border-brand-primary/20 text-zinc-100 px-4 py-3 text-sm shadow-md leading-relaxed">
            <MessagePrimitive.Content />
          </div>
          <span className="text-[10px] text-zinc-500 mt-1.5 mr-1 font-medium uppercase tracking-wider">
            You
          </span>
        </div>
        <div className="h-7 w-7 rounded-lg bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center shrink-0 shadow-sm mt-1">
          <User className="h-4 w-4 text-brand-primary" />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

// Assistant Message component
interface AssistantMessageProps {
  sources: SourceInfo[];
  agentStatus?: string;
}

const AssistantMessage: React.FC<AssistantMessageProps> = ({ sources, agentStatus }) => {
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <MessagePrimitive.Root className="flex justify-start w-full max-w-3xl mx-auto animate-fade-in">
      <div className="flex gap-3 max-w-[85%] w-full">
        <div className="h-7 w-7 rounded-lg bg-brand-secondary/15 border border-brand-secondary/30 flex items-center justify-center shrink-0 shadow-sm mt-1">
          <Bot className="h-4 w-4 text-brand-secondary" />
        </div>
        
        <div className="flex-1 flex flex-col items-start min-w-0">
          <div className="rounded-2xl rounded-tl-none bg-zinc-900/30 border border-brand-border text-zinc-200 px-4 py-3 text-sm shadow-sm leading-relaxed w-full">
            {agentStatus ? (
              <div className="py-1 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-zinc-400 font-medium select-none">
                  <Sparkles className="h-3.5 w-3.5 text-brand-primary animate-pulse" />
                  <span className="text-xs tracking-wide animate-pulse">{agentStatus}</span>
                </div>
                <div className="flex gap-1 pl-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary/45 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary/65 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary/85 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
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

                {/* RAG Sources Rendering */}
                {sources.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-zinc-800/50">
                    <button
                      onClick={() => setSourcesOpen(!sourcesOpen)}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium focus:outline-none"
                    >
                      <Sparkles className="h-3 w-3 text-brand-primary" />
                      <span>Sources used ({sources.length})</span>
                      <ChevronRight className={`h-3 w-3 transition-transform duration-200 ${sourcesOpen ? 'rotate-90 text-zinc-400' : 'text-zinc-600'}`} />
                    </button>

                    {sourcesOpen && (
                      <div className="flex flex-col gap-1.5 mt-2.5 animate-slide-down">
                        {sources.map((src, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/30 border border-zinc-900 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-950/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                              <span className="font-mono truncate">{src.source}</span>
                              <span className="text-[10px] text-zinc-600">
                                (Chunk {src.chunk_index})
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                src.relevance_score > 0.8
                                  ? 'bg-emerald-950/20 border border-emerald-900/50 text-emerald-400'
                                  : src.relevance_score > 0.5
                                  ? 'bg-amber-950/20 border border-amber-900/50 text-amber-400'
                                  : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                              }`}>
                                {(src.relevance_score * 100).toFixed(0)}% confidence
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          
          <span className="text-[10px] text-zinc-500 mt-1.5 ml-1 font-medium uppercase tracking-wider">
            My Brain LM
          </span>
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

