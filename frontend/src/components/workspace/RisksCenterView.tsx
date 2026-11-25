'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  FileCode,
  ExternalLink,
} from 'lucide-react';
import type { AnalysisRisk, EvidenceItem } from '@/types/analysis.types';

interface RisksCenterViewProps {
  risks: AnalysisRisk[];
  evidence?: EvidenceItem[];
  inferFiles: (risk: AnalysisRisk) => string[];
  onFocusRisk: (risk: AnalysisRisk) => void;
  onNavigateToFile?: (path: string) => void;
}

export function RisksCenterView({
  risks,
  evidence,
  inferFiles,
  onFocusRisk,
  onNavigateToFile,
}: RisksCenterViewProps) {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const filteredRisks = useMemo(() => {
    if (filterSeverity === 'all') return risks;
    return risks.filter((r) => r.severity === filterSeverity);
  }, [risks, filterSeverity]);

  const riskCounts = useMemo(() => {
    return risks.reduce(
      (acc, r) => {
        acc[r.severity] = (acc[r.severity] || 0) + 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );
  }, [risks]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 font-mono text-xs select-none">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Risk & Vulnerability Register
            </h3>
          </div>
          <p className="text-[11px] text-zinc-400 font-sans">
            AI-detected architectural complexities, potential vulnerabilities, and grounded mitigations.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-void p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setFilterSeverity('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              filterSeverity === 'all'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({risks.length})
          </button>
          <button
            onClick={() => setFilterSeverity('high')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              filterSeverity === 'high'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            High ({riskCounts.high})
          </button>
          <button
            onClick={() => setFilterSeverity('medium')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              filterSeverity === 'medium'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Medium ({riskCounts.medium})
          </button>
          <button
            onClick={() => setFilterSeverity('low')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all ${
              filterSeverity === 'low'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Low ({riskCounts.low})
          </button>
        </div>
      </div>

      {/* Risks Grid */}
      {filteredRisks.length === 0 ? (
        <div className="p-8 rounded-2xl border border-white/10 bg-surface/40 text-center text-xs text-zinc-400">
          {risks.length === 0
            ? 'No confirmed, inferred, or heuristic risks exceeded detection thresholds for the analyzed repository files.'
            : 'No risks match the selected severity filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRisks.map((risk, idx) => {
            const files = inferFiles(risk);
            const severityStyle =
              risk.severity === 'high'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : risk.severity === 'medium'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';

            const tier =
              risk.classification ||
              (risk.status === 'CONFIRMED' || risk.status === 'CONFIRMED AST'
                ? 'CONFIRMED'
                : risk.status === 'CONFIRMED_VULNERABILITY'
                ? 'CONFIRMED_VULNERABILITY'
                : risk.status === 'CONFIRMED_SINK'
                ? 'CONFIRMED_SINK'
                : risk.status === 'HEURISTIC'
                ? 'HEURISTIC'
                : 'INFERRED');

            const isUnanchoredAiRisk =
              (risk.detectionMethod === 'ai-architecture-review' || tier === 'INFERRED') &&
              files.length === 0 &&
              (!risk.sourceReferences || risk.sourceReferences.length === 0);

            const tierStyle =
              tier === 'CONFIRMED_VULNERABILITY'
                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                : tier === 'CONFIRMED_SINK'
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                : tier === 'CONFIRMED'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : tier === 'HEURISTIC'
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20';

            const tierLabel = isUnanchoredAiRisk
              ? 'AI Architectural Insight'
              : tier === 'CONFIRMED_VULNERABILITY'
              ? 'CONFIRMED VULNERABILITY'
              : tier === 'CONFIRMED_SINK'
              ? 'CONFIRMED SINK'
              : tier;

            return (
              <div
                key={`${risk.title}-${idx}`}
                className="p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${severityStyle}`}>
                        {risk.severity} Severity
                      </span>
                      <span className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded flex items-center gap-1 ${tierStyle}`}>
                        {tier === 'CONFIRMED' || tier === 'CONFIRMED_VULNERABILITY' ? (
                          <ShieldCheck className="w-2.5 h-2.5" />
                        ) : (
                          <HelpCircle className="w-2.5 h-2.5" />
                        )}
                        <span>{tierLabel}</span>
                      </span>
                      {risk.provenance === 'bundled-third-party' && (
                        <span className="text-[9px] font-mono uppercase text-violet-300 bg-violet-950/40 border border-violet-400/30 px-2 py-0.5 rounded">
                          Bundled Third-Party{risk.bundledPackageName ? `: ${risk.bundledPackageName}` : ''}
                        </span>
                      )}
                    </div>

                    {risk.category && (
                      <span className="text-[9px] font-mono uppercase text-cyan-300 bg-cyan-950/40 border border-cyan-400/20 px-2 py-0.5 rounded">
                        {risk.category}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-semibold text-white leading-snug">
                    {risk.title}
                  </h4>

                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                    {risk.detail}
                  </p>
                  {risk.detectionMethod && (
                    <p className="text-[10px] text-zinc-500 font-mono">
                      Method: {risk.detectionMethod}
                      {typeof risk.confidence === 'number' ? ` · Confidence ${risk.confidence}%` : ''}
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  {risk.mitigation && (
                    <div className="p-3 rounded-xl bg-void border border-white/5 space-y-1">
                      <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider block">
                        Recommended Mitigation
                      </span>
                      <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                        {risk.mitigation}
                      </p>
                    </div>
                  )}

                  {/* Concrete Affected Files (Clickable) */}
                  {files.length > 0 && (
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <span className="text-[10px] text-zinc-400 block font-mono">
                        Affected Source Files:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {files.slice(0, 4).map((file) => {
                          const ref = risk.sourceReferences?.find((r) => r.filePath === file);
                          const label = ref?.lineStart ? `${file}:L${ref.lineStart}` : file;
                          return (
                            <button
                              key={file}
                              type="button"
                              onClick={() => onNavigateToFile?.(file)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-cyan-500/15 text-zinc-300 hover:text-cyan-200 border border-white/10 hover:border-cyan-400/30 text-[10px] font-mono transition-all"
                              title={`Inspect ${label}`}
                            >
                              <FileCode className="w-2.5 h-2.5 text-cyan-400" />
                              <span className="truncate max-w-[160px]">{label}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions & Explorer Highlighting */}
                  {isUnanchoredAiRisk ? (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                      <span className="text-zinc-400 text-[11px] italic">
                        Qualitative observation (no source file mapped)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-500 bg-white/5 border border-white/5">
                        Repository Scope
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                      <span className="text-zinc-400 text-[11px]">
                        Mapped files: <strong className="text-zinc-200">{files.length}</strong>
                      </span>
                      {files.length > 0 ? (
                        <button
                          onClick={() => onFocusRisk(risk)}
                          className="px-3 py-1 rounded-lg border border-cyan-400/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                        >
                          <span>Highlight in Explorer</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-500 italic">No direct file target</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Verified Evidence Grounds Section */}
      {evidence && evidence.length > 0 && (
        <div className="p-5 rounded-2xl border border-white/10 bg-surface/40 backdrop-blur-md space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
              AST Evidence Findings ({evidence.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {evidence.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-white/5 bg-void/80 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onNavigateToFile?.(item.filePath)}
                    className="text-cyan-400 hover:underline font-mono text-[10px] truncate max-w-[220px] flex items-center gap-1"
                  >
                    <FileCode className="w-3 h-3" />
                    <span>{item.filePath}</span>
                  </button>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">
                    AST Finding
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 font-sans leading-snug">{item.finding}</p>
                <p className="text-[10px] text-zinc-500 font-mono">Relevance: {item.relevance}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
