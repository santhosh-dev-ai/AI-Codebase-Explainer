'use client';

import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  BrainCircuit,
  Wand2,
  Code2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { formatBytes, getFileIcon } from '@/lib/utils';
import type { FileExplanation } from '@/types/analysis.types';
import type { FileContentData, SelectionExplainState } from './workspace.types';
import { FileInsightDrawer } from './FileInsightDrawer';

interface CodeViewerPaneProps {
  selectedFile: FileContentData | null;
  isLoadingFile: boolean;
  fileInsight: FileExplanation | null;
  isLoadingFileInsight: boolean;
  fileInsightError: string;
  onRetryFileInsight: () => void;
  onExplainSelection: (snippet: string) => Promise<void>;
  isExplainingSelection: boolean;
  selectionExplanation: string;
  onDismissSelectionExplanation: () => void;
}

export function CodeViewerPane({
  selectedFile,
  isLoadingFile,
  fileInsight,
  isLoadingFileInsight,
  fileInsightError,
  onRetryFileInsight,
  onExplainSelection,
  isExplainingSelection,
  selectionExplanation,
  onDismissSelectionExplanation,
}: CodeViewerPaneProps) {
  const [copied, setCopied] = useState(false);
  const [isInsightOpen, setIsInsightOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsInsightOpen(true);
    }
  }, []);
  const [selectionTooltip, setSelectionTooltip] = useState<SelectionExplainState | null>(null);

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
    if (text.length < 5) {
      setSelectionTooltip(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectionTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      snippet: text,
      lineStart: 1,
      lineEnd: 1,
    });
  };

  const triggerExplainSelection = () => {
    if (!selectionTooltip?.snippet) return;
    onExplainSelection(selectionTooltip.snippet);
    setSelectionTooltip(null);
  };

  if (isLoadingFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950/40 p-6">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
        <p className="text-xs text-zinc-300 font-medium">Loading file content...</p>
        <p className="text-[11px] text-zinc-500">Preparing syntax and line mappings</p>
      </div>
    );
  }

  if (!selectedFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950/30 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center mb-4">
          <Code2 className="w-8 h-8 text-cyan-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-100 mb-1">Select a file to inspect</h3>
        <p className="text-xs text-zinc-400 max-w-sm mb-4">
          Click any file from the explorer on the left to view code and AI-powered architectural insights.
        </p>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Tip: You can highlight any snippet of code to explain it instantly</span>
        </div>
      </div>
    );
  }

  const lines = selectedFile.content.split('\n');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950/50 relative overflow-hidden">
      {/* Code Viewer Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-cyan-300 border border-white/15">
            {getFileIcon(selectedFile.path)}
          </span>
          <span className="text-xs font-mono font-medium text-zinc-100 truncate">
            {selectedFile.path}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
            {selectedFile.language}
          </span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            {selectedFile.lines} lines · {formatBytes(selectedFile.size)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-zinc-100 transition-colors"
            title="Copy code"
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

          {/* Toggle Docked Insights Drawer */}
          <button
            onClick={() => setIsInsightOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-all ${
              isInsightOpen
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle docked AI file insights"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Insights</span>
          </button>
        </div>
      </div>

      {/* Main Body: Code Lines & Docked Insights Panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Code Content */}
        <div
          className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed select-text relative"
          onMouseUp={handleMouseUp}
        >
          <pre className="inline-block min-w-full">
            <code>
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="flex hover:bg-white/5 rounded px-1 transition-colors"
                >
                  <span className="inline-block w-10 text-right pr-4 text-zinc-600 select-none flex-shrink-0 font-mono text-[11px]">
                    {idx + 1}
                  </span>
                  <span className="text-zinc-200 whitespace-pre font-mono">
                    {line || ' '}
                  </span>
                </div>
              ))}
            </code>
          </pre>
        </div>

        {/* Docked AI Insights Drawer (Side Panel, NOT Floating Overlay!) */}
        <FileInsightDrawer
          isOpen={isInsightOpen}
          onClose={() => setIsInsightOpen(false)}
          filePath={selectedFile.path}
          insight={fileInsight}
          isLoading={isLoadingFileInsight}
          error={fileInsightError}
          onRetry={onRetryFileInsight}
        />
      </div>

      {/* Code Selection Floating Action Pill */}
      {selectionTooltip && (
        <button
          onClick={triggerExplainSelection}
          disabled={isExplainingSelection}
          className="fixed z-50 -translate-x-1/2 -translate-y-full px-3 py-1.5 rounded-lg border border-cyan-400/30 bg-zinc-950/90 text-xs text-cyan-200 backdrop-blur-xl shadow-2xl hover:scale-105 transition-all flex items-center gap-1.5 disabled:opacity-60"
          style={{ left: selectionTooltip.x, top: selectionTooltip.y }}
        >
          <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>{isExplainingSelection ? 'Explaining...' : 'Explain selected code'}</span>
        </button>
      )}

      {/* Selection Explanation Popover */}
      {selectionExplanation && (
        <div className="absolute right-4 bottom-4 max-w-md rounded-xl border border-cyan-400/30 bg-zinc-950/95 backdrop-blur-xl p-4 shadow-2xl z-40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-cyan-400" />
              <p className="text-xs font-semibold text-cyan-100">Selection Explanation</p>
            </div>
            <button
              onClick={onDismissSelectionExplanation}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
            {selectionExplanation}
          </p>
        </div>
      )}
    </div>
  );
}
