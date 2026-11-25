'use client';

import React from 'react';
import { Sparkles, Info } from 'lucide-react';
import type { ArchitectureOverview } from '@/types/analysis.types';
import type { ScoreItem } from './workspace.types';

interface OverviewTabProps {
  overview: ArchitectureOverview;
  reportScores: ScoreItem[];
  onFocusComplexity: () => void;
  onFocusModule: (path: string) => void;
}

export function OverviewTab({
  overview,
  reportScores,
  onFocusComplexity,
  onFocusModule,
}: OverviewTabProps) {
  return (
    <div className="space-y-3">
      {/* Overview & Executive Summary */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            Repository Overview
          </h4>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">{overview.summary}</p>

        {overview.executiveBullets && overview.executiveBullets.length > 0 && (
          <ul className="mt-2.5 space-y-1.5 text-xs text-zinc-200 border-t border-white/5 pt-2">
            {overview.executiveBullets.slice(0, 5).map((point, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-cyan-400 font-bold">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Scorecard */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            Quality Scorecard
          </h4>
          <button
            onClick={onFocusComplexity}
            className="text-[11px] px-2 py-0.5 rounded border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 transition-colors"
          >
            Highlight hot spots
          </button>
        </div>

        <div className="space-y-2.5">
          {reportScores.map((score) => {
            const clamped = Math.max(0, Math.min(100, Math.round(score.value)));
            return (
              <div key={score.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-300 capitalize">{score.key}</span>
                    <span title={score.tooltip} className="text-zinc-500 hover:text-zinc-300 cursor-help">
                      <Info className="w-3 h-3" />
                    </span>
                  </div>
                  <span className="font-semibold text-zinc-100">{clamped}/100</span>
                </div>
                <div className="h-2 rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${clamped}%`,
                      background: `linear-gradient(90deg, ${score.colorFrom}, ${score.colorTo})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Profile Chips */}
      <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
          Architecture Profile
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-white/5 border border-white/5">
            <span className="text-[10px] text-zinc-500 block uppercase">Pattern</span>
            <span className="text-zinc-200 font-medium truncate block">{overview.pattern || 'Modular'}</span>
          </div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/5">
            <span className="text-[10px] text-zinc-500 block uppercase">Type</span>
            <span className="text-zinc-200 font-medium truncate block">{overview.projectType || 'Full-Stack'}</span>
          </div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/5">
            <span className="text-[10px] text-zinc-500 block uppercase">Framework</span>
            <span className="text-zinc-200 font-medium truncate block">
              {overview.framework || (overview.primaryEcosystem === 'python' ? 'None (Python)' : 'None detected')}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-white/5 border border-white/5">
            <span className="text-[10px] text-zinc-500 block uppercase">Confidence</span>
            <span className="text-cyan-300 font-medium truncate block">{overview.confidence ?? 90}%</span>
          </div>
        </div>
      </div>

      {/* Key Modules */}
      {overview.keyModules && overview.keyModules.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Key Modules
          </h4>
          <div className="space-y-1.5">
            {overview.keyModules.slice(0, 6).map((module, idx) => (
              <button
                key={`${module.path}-${idx}`}
                onClick={() => onFocusModule(module.path)}
                className="w-full text-left p-2 rounded-lg border border-white/5 bg-white/5 hover:border-cyan-400/30 hover:bg-cyan-500/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-100">{module.name}</span>
                  <span className="text-[10px] text-cyan-400 font-mono truncate max-w-[140px]">
                    {module.path}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2">
                  {module.responsibility}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
