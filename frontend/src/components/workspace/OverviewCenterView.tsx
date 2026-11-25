'use client';

import React from 'react';
import {
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  Flame,
} from 'lucide-react';
import type { ArchitectureOverview } from '@/types/analysis.types';
import type { ScoreItem } from './workspace.types';
import { LatticeLoader } from '@/components/react-bits';

interface OverviewCenterViewProps {
  overview: ArchitectureOverview | null;
  reportScores: ScoreItem[];
  onFocusComplexity: () => void;
  onNavigateToFile: (path: string) => void;
  isLoading: boolean;
}

export function OverviewCenterView({
  overview,
  reportScores,
  onFocusComplexity,
  onNavigateToFile,
  isLoading,
}: OverviewCenterViewProps) {
  if (isLoading || !overview) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs font-mono text-zinc-400">
        <LatticeLoader
          size="md"
          label="Synthesizing Repository Overview"
          sublabel="Compiling quality scorecard & architectural vectors..."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 font-mono text-xs select-none">
      {/* Overview Banner */}
      <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white tracking-wide">
            Repository Executive Summary
          </h3>
        </div>

        <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
          {overview.summary}
        </p>

        {overview.executiveBullets && overview.executiveBullets.length > 0 && (
          <ul className="mt-4 space-y-2 text-xs text-zinc-300 font-sans border-t border-white/5 pt-3">
            {overview.executiveBullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-cyan-400 font-mono font-bold">•</span>
                <span className="leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quality Scorecard & Architecture Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Scorecard Meters */}
        <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              Quality Scorecard
            </h4>
            <button
              onClick={onFocusComplexity}
              className="text-[11px] px-2.5 py-1 rounded-md border border-amber-400/30 text-amber-300 hover:bg-amber-400/10 transition-colors flex items-center gap-1.5"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Locate Hot Spots</span>
            </button>
          </div>

          <div className="space-y-3">
            {reportScores.map((score) => {
              const clamped = Math.max(0, Math.min(100, Math.round(score.value)));
              return (
                <div key={score.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 capitalize flex items-center gap-1.5">
                      {score.key}
                      <span title={score.tooltip} className="text-zinc-500 hover:text-zinc-300 cursor-help">
                        <Info className="w-3 h-3" />
                      </span>
                    </span>
                    <span className="font-semibold text-zinc-100">{clamped}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-void border border-white/5 overflow-hidden">
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

        {/* Profile Attributes */}
        <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-4">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
            Architecture Profile
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-void border border-white/5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Pattern</span>
              <span className="text-sm font-semibold text-cyan-200 truncate block">
                {overview.pattern || 'Modular'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-void border border-white/5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Project Type</span>
              <span className="text-sm font-semibold text-zinc-100 truncate block">
                {overview.projectType || 'Library / Service'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-void border border-white/5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Framework</span>
              <span className="text-sm font-semibold text-zinc-100 truncate block">
                {overview.framework || (overview.primaryEcosystem === 'python' ? 'None (Python)' : 'None detected')}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-void border border-white/5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Confidence</span>
              <span className="text-sm font-semibold text-emerald-400 truncate block">
                {overview.confidence ?? 92}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Modules Directory */}
      {overview.keyModules && overview.keyModules.length > 0 && (
        <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Key Modules & Components ({overview.keyModules.length})
              </h4>
            </div>
            <span className="text-[11px] text-zinc-500">Click to view source</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overview.keyModules.map((module, idx) => (
              <button
                key={`${module.path}-${idx}`}
                onClick={() => onNavigateToFile(module.path)}
                className="text-left p-3 rounded-xl border border-white/5 bg-void hover:border-cyan-400/30 hover:bg-cyan-500/10 transition-all space-y-1.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100 group-hover:text-cyan-200 transition-colors">
                    {module.name}
                  </span>
                  <span className="text-[10px] text-zinc-400 flex items-center gap-1 opacity-60 group-hover:opacity-100">
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 font-sans line-clamp-2 leading-relaxed">
                  {module.responsibility}
                </p>
                <span className="text-[10px] text-cyan-400 truncate block pt-1">
                  {module.path}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
