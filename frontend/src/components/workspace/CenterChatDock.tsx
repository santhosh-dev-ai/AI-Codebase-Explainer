'use client';

import React, { useState, type FormEvent, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare,
  FileCode,
  ChevronDown,
  Maximize2,
  Minimize2,
  Sparkles,
  CornerDownLeft,
  Copy,
  Check,
  Terminal,
} from 'lucide-react';
import type { LocalChatMessage } from './workspace.types';
import { ThoughtLine } from '@/components/react-bits';

interface CenterChatDockProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  chatHeight: number;
  onResizeStart: () => void;
  chatScrollRef: React.RefObject<HTMLDivElement>;
  isLoadingChatHistory: boolean;
  chatMessages: LocalChatMessage[];
  quickPrompts: string[];
  openQuickPrompt: (prompt: string) => void;
  chatError: string;
  submitChat: (event: FormEvent) => Promise<void>;
  chatInput: string;
  setChatInput: (value: string) => void;
  selectedFilePath?: string;
  isSendingChat: boolean;
}

// Custom Syntax / Code Block with one-click Copy
function ChatCodeBlock({
  language,
  value,
}: {
  language?: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="relative my-2.5 rounded-lg border border-white/10 bg-slate-950/80 overflow-hidden font-mono text-xs shadow-md">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-surface/80 border-b border-white/10 text-[10px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3 h-3 text-cyan-400" />
          <span className="uppercase font-semibold tracking-wider text-zinc-300">
            {language || 'code'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
          title="Copy snippet"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-zinc-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <pre className="p-3 overflow-x-auto text-zinc-200 text-xs font-mono leading-relaxed select-text">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export function CenterChatDock({
  isOpen,
  onToggleOpen,
  chatHeight,
  onResizeStart,
  chatScrollRef,
  isLoadingChatHistory,
  chatMessages,
  quickPrompts,
  openQuickPrompt,
  chatError,
  submitChat,
  chatInput,
  setChatInput,
  selectedFilePath,
  isSendingChat,
}: CenterChatDockProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSendingChat && chatInput.trim()) {
        submitChat(e as unknown as FormEvent);
      }
    }
  };

  const copyMessageContent = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      // Fallback
    }
  };

  // 1. Collapsed State: Minimal unobtrusive bottom bar
  if (!isOpen) {
    return (
      <div className="flex-shrink-0 border-t border-white/10 bg-void/90 backdrop-blur-md px-4 py-2 flex items-center justify-between select-none z-20">
        <button
          onClick={onToggleOpen}
          className="flex-1 flex items-center gap-3 text-left group"
        >
          <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-400/20 text-violet-400 group-hover:scale-105 transition-all">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-300 font-medium group-hover:text-cyan-200 transition-colors">
              Ask AI about codebase...
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
              Ctrl+K
            </span>
          </div>

          {selectedFilePath && (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400 max-w-xs truncate">
              <FileCode className="w-3 h-3 text-cyan-400 flex-shrink-0" />
              <span className="truncate">{selectedFilePath.split('/').pop()}</span>
            </div>
          )}
        </button>

        <button
          onClick={onToggleOpen}
          className="px-2.5 py-1 text-xs font-mono text-zinc-400 hover:text-zinc-100 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
        >
          Open Chat
        </button>
      </div>
    );
  }

  // Effective height when expanded or fullscreen
  const effectiveHeight = isFullScreen ? 'calc(100vh - 60px)' : `${chatHeight}px`;

  return (
    <div
      className={`relative flex-shrink-0 border-t border-white/10 bg-void/95 backdrop-blur-xl flex flex-col font-mono text-xs select-none z-30 transition-all ${
        isFullScreen ? 'fixed inset-x-0 bottom-0 h-full max-h-[85vh] shadow-2xl' : ''
      }`}
      style={!isFullScreen ? { height: effectiveHeight } : undefined}
    >
      {/* Resizer Handle (only when not fullscreen) */}
      {!isFullScreen && (
        <button
          type="button"
          onMouseDown={onResizeStart}
          title="Drag to resize chat panel"
          className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-16 cursor-row-resize rounded-full border border-cyan-400/30 bg-cyan-500/20 hover:bg-cyan-400/40 transition-colors"
        />
      )}

      {/* Dock Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-surface/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            Codebase Chat
          </h3>

          {selectedFilePath && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-zinc-400 max-w-xs truncate">
              <FileCode className="w-3 h-3 text-cyan-400 flex-shrink-0" />
              <span className="truncate">Context: {selectedFilePath}</span>
            </div>
          )}
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded transition-colors"
            title={isFullScreen ? 'Exit fullscreen' : 'Expand conversation'}
          >
            {isFullScreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onToggleOpen}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded transition-colors"
            title="Collapse chat"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dock Content Body: Message Stream & Input Box */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 p-2.5 gap-2.5 overflow-hidden">
        {/* Message Stream */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-surface/40 p-3 space-y-3 chat-scrollbar select-text"
        >
          {isLoadingChatHistory ? (
            <div className="flex items-center justify-center py-6">
              <ThoughtLine isThinking label="Restoring session conversation..." variant="cyan" />
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="text-[11px] text-zinc-400 space-y-2.5 p-1 select-none">
              <p className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Suggested Architectural Questions</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => openQuickPrompt(prompt)}
                    className="w-full text-left p-2 rounded-lg border border-white/5 bg-void hover:border-cyan-400/30 hover:bg-cyan-500/10 text-cyan-200 transition-colors truncate text-[11px]"
                  >
                    • {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl p-3.5 text-xs leading-relaxed transition-all ${
                  msg.role === 'assistant'
                    ? 'bg-surface/90 border border-cyan-400/25 text-zinc-100 shadow-md'
                    : 'bg-white/5 border border-white/10 text-zinc-200 ml-6'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between mb-2 text-[10px] font-semibold uppercase tracking-wider font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className={msg.role === 'assistant' ? 'text-cyan-300' : 'text-zinc-300'}>
                      {msg.role === 'assistant' ? 'AI Assistant' : 'You'}
                    </span>
                    {msg.role === 'assistant' && (
                      <span className="text-[9px] px-1 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                        verified
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.role === 'assistant' && (
                      <button
                        onClick={() => copyMessageContent(msg.id, msg.content)}
                        className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                        title="Copy entire response"
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Markdown Rendered Body */}
                <div className="font-sans text-xs text-zinc-200 leading-relaxed space-y-2 select-text">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match && !String(children).includes('\n');
                        if (isInline) {
                          return (
                            <code
                              className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono text-[11px]"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        }
                        return (
                          <ChatCodeBlock
                            language={match ? match[1] : undefined}
                            value={String(children).replace(/\n$/, '')}
                          />
                        );
                      },
                      h1({ children }) {
                        return <h4 className="text-sm font-bold text-white mt-2 mb-1">{children}</h4>;
                      },
                      h2({ children }) {
                        return <h5 className="text-xs font-bold text-cyan-200 mt-2 mb-1">{children}</h5>;
                      },
                      h3({ children }) {
                        return <h6 className="text-xs font-semibold text-zinc-200 mt-1 mb-0.5">{children}</h6>;
                      },
                      ul({ children }) {
                        return <ul className="list-disc pl-4 space-y-1 my-1.5">{children}</ul>;
                      },
                      ol({ children }) {
                        return <ol className="list-decimal pl-4 space-y-1 my-1.5">{children}</ol>;
                      },
                      li({ children }) {
                        return <li className="text-zinc-300 text-xs">{children}</li>;
                      },
                      blockquote({ children }) {
                        return (
                          <blockquote className="border-l-2 border-cyan-400/50 pl-3 py-1 my-2 text-zinc-400 italic bg-white/5 rounded-r">
                            {children}
                          </blockquote>
                        );
                      },
                      table({ children }) {
                        return (
                          <div className="overflow-x-auto my-2 rounded border border-white/10">
                            <table className="w-full text-left text-[11px] font-mono">{children}</table>
                          </div>
                        );
                      },
                      th({ children }) {
                        return <th className="bg-surface/80 p-2 text-zinc-300 border-b border-white/10">{children}</th>;
                      },
                      td({ children }) {
                        return <td className="p-2 border-b border-white/5 text-zinc-400">{children}</td>;
                      },
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          )}

          {/* React Bits ThoughtLine Indicator when waiting for AI stream */}
          {isSendingChat && (
            <div className="rounded-xl p-3 bg-surface/70 border border-cyan-400/20">
              <ThoughtLine
                isThinking={true}
                label="Analyzing codebase symbols & tracing execution..."
                variant="cyan"
              />
            </div>
          )}
        </div>

        {/* Input Form Column */}
        <div className="w-full md:w-80 flex flex-col justify-between flex-shrink-0">
          <form onSubmit={submitChat} className="flex-1 flex flex-col gap-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder={
                selectedFilePath
                  ? `Ask about ${selectedFilePath.split('/').pop()}...`
                  : 'Ask about architecture, data flows, or bugs...'
              }
              className="flex-1 resize-none rounded-xl border border-white/10 bg-surface/70 p-2.5 text-xs font-sans text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400/50"
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-400 hidden sm:inline">
                Enter to send · Shift+Enter newline
              </span>
              <button
                type="submit"
                disabled={isSendingChat || !chatInput.trim()}
                className="h-8 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-void font-semibold text-xs disabled:opacity-40 transition-all flex-shrink-0 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
              >
                <span>Send</span>
                <CornerDownLeft className="w-3 h-3" />
              </button>
            </div>
          </form>

          {chatError && <p className="text-[11px] text-amber-400 mt-1">{chatError}</p>}
        </div>
      </div>
    </div>
  );
}
