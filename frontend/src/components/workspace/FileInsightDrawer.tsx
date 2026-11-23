'use client';

import React from 'react';
import {
  BrainCircuit,
  RefreshCcw,
  X,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import type { FileExplanation } from '@/types/analysis.types';

interface FileInsightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  insight: FileExplanation | null;
  isLoading: boolean;
  error: string;
  onRetry: () => void;
}

export function FileInsightDrawer({
  isOpen,
  onClose,
  filePath,
  insight,
  isLoading,
  error,
  onRetry,
}: FileInsightDrawerProps) {
  if (!isOpen) return null;

  const fileName = filePath.split('/').pop() || filePath;

  return (
    <aside className="absolute md:relative inset-y-0 right-0 w-full sm:w-80 lg:w-96 flex-shrink-0 flex flex-col h-full bg-zinc-950/95 border-l border-white/10 z-20 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <BrainCircuit className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-zinc-100 truncate">AI File Insights</h3>
            <p className="text-[10px] text-zinc-400 truncate">{fileName}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {insight?.complexity && (
            <span
              className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                insight.complexity === 'high'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  : insight.complexity === 'medium'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {insight.complexity}
            </span>
          )}

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-white/10 rounded transition-colors"
            title="Close insights drawer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs text-zinc-200 scroll-smooth momentum-scroll">
        {isLoading ? (
          <div className="space-y-3 p-2">
            <div className="h-4 rounded bg-white/10 animate-pulse w-3/4" />
            <div className="h-3 rounded bg-white/10 animate-pulse w-full" />
            <div className="h-3 rounded bg-white/10 animate-pulse w-5/6" />
            <p className="text-xs text-cyan-300 animate-pulse pt-2">Analyzing functions and dependencies...</p>
          </div>
        ) : error ? (
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-xs">
              <AlertCircle className="w-4 h-4" />
              <span>Failed to generate insights</span>
            </div>
            <p className="text-[11px] text-zinc-300">{error}</p>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-white/10 hover:bg-white/15 border border-white/20 text-zinc-100 transition-colors"
            >
              <RefreshCcw className="w-3 h-3" />
              Retry Analysis
            </button>
          </div>
        ) : insight ? (
          <>
            {/* Purpose */}
            <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block">
                Primary Purpose
              </span>
              <p className="leading-relaxed text-zinc-200">{insight.purpose}</p>
            </div>

            {/* Key Functions */}
            {insight.keyFunctions && insight.keyFunctions.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Key Functions ({insight.keyFunctions.length})
                </span>
                <div className="space-y-2">
                  {insight.keyFunctions.map((fn, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-white/5 bg-zinc-900/60 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-cyan-300 font-medium truncate">
                          {fn.name}
                        </span>
                        {fn.lineStart && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            L{fn.lineStart}{fn.lineEnd ? `-L${fn.lineEnd}` : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-300 leading-snug">{fn.description}</p>
                      {fn.parameters && fn.parameters.length > 0 && (
                        <div className="text-[10px] text-zinc-400 font-mono pt-0.5">
                          params: {fn.parameters.join(', ')}
                        </div>
                      )}
                      {fn.returns && (
                        <div className="text-[10px] text-zinc-400 font-mono">
                          returns: {fn.returns}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Architecture Patterns & Suggestions */}
            {insight.patterns && insight.patterns.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block flex items-center gap-1">
                  <Lightbulb className="w-3 h-3 text-amber-400" />
                  Patterns & Observations
                </span>
                <ul className="space-y-1 text-[11px] text-zinc-300">
                  {insight.patterns.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-400">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dependencies & Exports */}
            {(insight.dependencies?.length > 0 || insight.exports?.length > 0) && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {insight.dependencies && insight.dependencies.length > 0 && (
                  <div className="p-2 rounded-lg border border-white/5 bg-zinc-900/40">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                      Imports ({insight.dependencies.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {insight.dependencies.slice(0, 6).map((dep, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-zinc-300 truncate max-w-full"
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {insight.exports && insight.exports.length > 0 && (
                  <div className="p-2 rounded-lg border border-white/5 bg-zinc-900/40">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                      Exports ({insight.exports.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {insight.exports.slice(0, 6).map((exp, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-cyan-200 truncate max-w-full"
                        >
                          {exp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="p-4 text-center text-xs text-zinc-500">
            No insight generated yet for this file.
          </div>
        )}
      </div>
    </aside>
  );
}
