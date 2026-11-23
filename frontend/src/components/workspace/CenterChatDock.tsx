'use client';

import React, { type FormEvent, type KeyboardEvent } from 'react';
import { MessageSquare, Send, Loader2, FileCode } from 'lucide-react';
import type { LocalChatMessage } from './workspace.types';

interface CenterChatDockProps {
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

export function CenterChatDock({
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
  const contentHeight = Math.max(90, chatHeight - 48);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSendingChat && chatInput.trim()) {
        submitChat(e as unknown as FormEvent);
      }
    }
  };

  return (
    <div
      className="relative flex-shrink-0 border-t border-white/10 bg-zinc-950/85 backdrop-blur-md px-3 pt-2 pb-3"
      style={{ height: `${chatHeight}px` }}
    >
      {/* Drag handle for resizing */}
      <button
        type="button"
        onMouseDown={onResizeStart}
        title="Drag to resize chat section"
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-16 cursor-row-resize rounded-full border border-cyan-400/30 bg-cyan-500/20 hover:bg-cyan-400/40 transition-colors"
      />

      {/* Dock Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Codebase Chat
          </h3>
        </div>

        {selectedFilePath && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-zinc-400 max-w-xs truncate">
            <FileCode className="w-3 h-3 text-cyan-400 flex-shrink-0" />
            <span className="truncate">Context: {selectedFilePath}</span>
          </div>
        )}
      </div>

      {/* Dock Content: Messages on Left, Input on Right */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-2.5" style={{ height: `${contentHeight}px` }}>
        {/* Messages List */}
        <div
          ref={chatScrollRef}
          className="overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/50 p-2.5 space-y-2.5 text-xs text-zinc-100 chat-scrollbar"
        >
          {isLoadingChatHistory ? (
            <div className="flex items-center gap-2 p-3 text-xs text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>Loading conversation history...</span>
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="text-[11px] text-zinc-400 space-y-2 p-1">
              <p className="font-medium text-zinc-300">Suggested questions:</p>
              <div className="space-y-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => openQuickPrompt(prompt)}
                    className="w-full text-left p-1.5 rounded-lg border border-white/5 bg-white/5 hover:border-cyan-400/30 hover:bg-cyan-500/10 text-cyan-200 transition-colors truncate"
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
                className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-cyan-950/30 border border-cyan-400/20 text-cyan-50'
                    : 'bg-white/5 border border-white/10 text-zinc-100 ml-4'
                }`}
              >
                <div className="flex items-center justify-between mb-1 opacity-70 text-[10px] font-semibold uppercase tracking-wider">
                  <span>{msg.role === 'assistant' ? 'AI Assistant' : 'You'}</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="whitespace-pre-wrap font-sans text-xs">{msg.content}</div>
              </div>
            ))
          )}
        </div>

        {/* Input Form */}
        <div className="flex flex-col justify-between">
          <form onSubmit={submitChat} className="flex-1 flex flex-col gap-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder={
                selectedFilePath
                  ? `Ask about ${selectedFilePath.split('/').pop()}...`
                  : 'Ask a question about the repository...'
              }
              className="flex-1 resize-none rounded-xl border border-white/10 bg-zinc-900/60 p-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400/50"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-500 hidden sm:inline">
                Press Enter to send
              </span>
              <button
                type="submit"
                disabled={isSendingChat || !chatInput.trim()}
                className="h-8 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-xs disabled:opacity-50 hover:brightness-110 transition-all flex-shrink-0"
              >
                {isSendingChat ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Thinking...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask</span>
                  </>
                )}
              </button>
            </div>
          </form>
          {chatError && (
            <p className="text-[11px] text-amber-400 mt-1.5">{chatError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
