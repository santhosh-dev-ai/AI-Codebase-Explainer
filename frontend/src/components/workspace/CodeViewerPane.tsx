'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  Copy,
  Check,
  Search,
  Wand2,
  Code2,
  Loader2,
  Sparkles,
  MessageSquare,
  X,
} from 'lucide-react';
import { formatBytes, getFileIcon } from '@/lib/utils';
import type { FileContentData, SelectionExplainState } from './workspace.types';

interface CodeViewerPaneProps {
  selectedFile: FileContentData | null;
  isLoadingFile: boolean;
  onExplainSelection: (snippet: string) => Promise<void>;
  onAskAboutSelection?: (snippet: string) => void;
  isExplainingSelection: boolean;
  selectionExplanation: string;
  onDismissSelectionExplanation: () => void;
  onOpenInspectorTab?: (tab: 'explain' | 'architecture' | 'insights' | 'risks' | 'overview') => void;
}

export function CodeViewerPane({
  selectedFile,
  isLoadingFile,
  onExplainSelection,
  onAskAboutSelection,
  isExplainingSelection,
  selectionExplanation,
  onDismissSelectionExplanation,
  onOpenInspectorTab: _onOpenInspectorTab,
}: CodeViewerPaneProps) {
  const [copied, setCopied] = useState(false);
  const [fileSearchOpen, setFileSearchOpen] = useState(false);
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const [selectionTooltip, setSelectionTooltip] = useState<SelectionExplainState | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    if (!selectedFile?.content) return;
    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionTooltip(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 4) {
      setSelectionTooltip(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectionTooltip({
      x: rect.left + rect.width / 2,
      y: Math.max(10, rect.top - 12),
      snippet: text,
      lineStart: 1,
      lineEnd: 1,
    });
  };

  const lines = useMemo(() => {
    if (!selectedFile?.content) return [];
    return selectedFile.content.split('\n');
  }, [selectedFile?.content]);

  // Match count for search in file
  const searchMatchCount = useMemo(() => {
    if (!fileSearchTerm.trim() || !selectedFile?.content) return 0;
    const term = fileSearchTerm.toLowerCase();
    let count = 0;
    lines.forEach((line) => {
      if (line.toLowerCase().includes(term)) count++;
    });
    return count;
  }, [fileSearchTerm, selectedFile?.content, lines]);

  if (isLoadingFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-void/60 p-6 text-center select-none font-mono">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
        <p className="text-xs text-zinc-200 font-semibold">Streaming file AST & syntax...</p>
        <p className="text-[11px] text-zinc-500 mt-1">Calculating line numbers and token scopes</p>
      </div>
    );
  }

  if (!selectedFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-void/40 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center mb-4 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
          <Code2 className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">Select a file from Explorer</h3>
        <p className="text-xs text-zinc-400 max-w-sm mb-4 leading-relaxed">
          Click any source file in the left pane to view code syntax, trace functions, and inspect contextual AI analysis.
        </p>
        <div className="flex items-center gap-2 text-[11px] text-zinc-400 bg-surface/80 border border-white/10 px-3 py-1.5 rounded-lg font-mono">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Tip: Highlight any line or block to explain it instantly</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-h-0 bg-void/50 relative overflow-hidden select-text"
      onMouseUp={handleMouseUp}
    >
      {/* Code Viewer Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-surface/50 flex-shrink-0 select-none">
        {/* File Metadata */}
        <div className="flex items-center gap-2 min-w-0 font-mono">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-cyan-300 border border-white/10">
            {getFileIcon(selectedFile.path)}
          </span>
          <span className="text-xs text-zinc-200 font-medium truncate">
            {selectedFile.path}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-zinc-400">
            {selectedFile.language}
          </span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            {selectedFile.lines} lines · {formatBytes(selectedFile.size)}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Find in file toggle */}
          <button
            onClick={() => setFileSearchOpen((prev) => !prev)}
            className={`p-1.5 rounded text-xs transition-colors ${
              fileSearchOpen
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
            title="Find in file"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-zinc-100 transition-colors"
            title="Copy file content"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* In-File Search Bar */}
      {fileSearchOpen && (
        <div className="flex items-center gap-2 px-3.5 py-1.5 border-b border-white/10 bg-elevated/80 backdrop-blur-md select-none text-xs font-mono">
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={fileSearchTerm}
            onChange={(e) => setFileSearchTerm(e.target.value)}
            placeholder="Find in current file..."
            className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
            autoFocus
          />
          {fileSearchTerm && (
            <span className="text-[10px] text-zinc-400">
              {searchMatchCount} {searchMatchCount === 1 ? 'match' : 'matches'}
            </span>
          )}
          <button
            onClick={() => {
              setFileSearchOpen(false);
              setFileSearchTerm('');
            }}
            className="text-zinc-400 hover:text-zinc-200 p-1"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Code Viewer Body */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
        <pre className="inline-block min-w-full">
          <code>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const matchesSearch =
                fileSearchTerm.trim().length > 0 &&
                line.toLowerCase().includes(fileSearchTerm.toLowerCase());

              return (
                <div
                  key={idx}
                  className={`flex hover:bg-white/5 rounded px-1 transition-colors ${
                    matchesSearch ? 'bg-cyan-500/15 border-l border-cyan-400' : ''
                  }`}
                >
                  <span className="inline-block w-11 text-right pr-4 text-zinc-600 select-none flex-shrink-0 text-[11px]">
                    {lineNum}
                  </span>
                  <span className="text-zinc-200 whitespace-pre font-mono">
                    {line || ' '}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Contextual Code Selection Action Pill */}
      {selectionTooltip && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full px-1.5 py-1 rounded-xl border border-cyan-400/40 bg-surface/95 backdrop-blur-xl shadow-2xl flex items-center gap-1 text-xs select-none"
          style={{ left: selectionTooltip.x, top: selectionTooltip.y }}
        >
          <button
            onClick={() => {
              onExplainSelection(selectionTooltip.snippet);
              setSelectionTooltip(null);
            }}
            disabled={isExplainingSelection}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 font-mono text-[11px] transition-colors"
          >
            <Wand2 className="w-3 h-3 text-cyan-400" />
            <span>{isExplainingSelection ? 'Explaining...' : 'Explain selection'}</span>
          </button>

          {onAskAboutSelection && (
            <button
              onClick={() => {
                onAskAboutSelection(selectionTooltip.snippet);
                setSelectionTooltip(null);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/10 text-zinc-300 font-mono text-[11px] transition-colors"
            >
              <MessageSquare className="w-3 h-3 text-violet-400" />
              <span>Ask AI</span>
            </button>
          )}
        </div>
      )}

      {/* Inline Selection Explanation Popover */}
      {selectionExplanation && (
        <div className="absolute right-4 bottom-4 max-w-lg rounded-2xl border border-cyan-400/30 bg-surface/95 backdrop-blur-xl p-4 shadow-2xl z-40 select-text">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-cyan-400" />
              <p className="text-xs font-semibold text-cyan-200 font-mono">
                Selection Explanation
              </p>
            </div>
            <button
              onClick={onDismissSelectionExplanation}
              className="text-zinc-400 hover:text-zinc-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
            {selectionExplanation}
          </p>
        </div>
      )}
    </div>
  );
}
