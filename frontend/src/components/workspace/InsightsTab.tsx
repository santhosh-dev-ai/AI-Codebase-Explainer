'use client';

import React from 'react';
import { LineChart, Flame, Compass } from 'lucide-react';
import type { ArchitectureOverview } from '@/types/analysis.types';

interface InsightsTabProps {
  overview: ArchitectureOverview;
  highComplexityFiles: string[];
  onFocusComplexity: () => void;
  onFocusFile: (path: string) => void;
}

export function InsightsTab({
  overview,
  highComplexityFiles,
  onFocusComplexity,
  onFocusFile,
}: InsightsTabProps) {
  return (
    <div className="space-y-3">
      {/* High Complexity Hot Spots */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
              Complexity Hot Spots
            </h4>
          </div>
          <button
            onClick={onFocusComplexity}
            className="text-[11px] px-2 py-0.5 rounded border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 transition-colors"
          >
            Highlight in tree
          </button>
        </div>

        {highComplexityFiles.length === 0 ? (
          <p className="text-xs text-zinc-400">No high-complexity hot spots identified.</p>
        ) : (
          <div className="space-y-1.5">
            {highComplexityFiles.slice(0, 6).map((file, idx) => (
              <button
                key={idx}
                onClick={() => onFocusFile(file)}
                className="w-full text-left text-xs font-mono rounded-lg border border-white/5 bg-zinc-900/50 px-2.5 py-1.5 text-zinc-200 hover:border-amber-400/30 hover:bg-amber-500/10 transition-colors truncate"
              >
                {file}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Concrete Evidence Highlights */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            Architectural Evidence
          </h4>
        </div>

        <div className="space-y-2">
          {(overview.evidence || []).slice(0, 6).map((item, idx) => (
            <button
              key={`${item.filePath}-${idx}`}
              onClick={() => onFocusFile(item.filePath)}
              className="w-full rounded-lg border border-white/5 bg-zinc-900/50 p-2.5 text-left hover:border-emerald-400/30 hover:bg-emerald-500/10 transition-colors space-y-1"
            >
              <span className="text-[10px] text-emerald-400 font-mono block truncate">
                {item.filePath}
              </span>
              <p className="text-xs text-zinc-100 font-medium">{item.finding}</p>
              <p className="text-[11px] text-zinc-400">{item.relevance}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Deep-Dive Runtime & Lifecycle Notes */}
      {overview.deepDive && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3 space-y-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              Deep-Dive Analysis
            </h4>
          </div>

          <div className="space-y-2 text-zinc-300">
            {overview.deepDive.runtimeFlow && (
              <div className="p-2 rounded-lg bg-white/5 border border-white/5 space-y-0.5">
                <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider block">
                  Runtime Execution Flow
                </span>
                <p className="text-[11px] leading-relaxed">{overview.deepDive.runtimeFlow}</p>
              </div>
            )}

            {overview.deepDive.dataLifecycle && (
              <div className="p-2 rounded-lg bg-white/5 border border-white/5 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">
                  Data Lifecycle
                </span>
                <p className="text-[11px] leading-relaxed">{overview.deepDive.dataLifecycle}</p>
              </div>
            )}

            {overview.deepDive.qualitySignals && (
              <div className="p-2 rounded-lg bg-white/5 border border-white/5 space-y-0.5">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">
                  Quality Signals
                </span>
                <p className="text-[11px] leading-relaxed">{overview.deepDive.qualitySignals}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
