'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { AnalysisRisk, EvidenceItem } from '@/types/analysis.types';

interface RisksTabProps {
  risks: AnalysisRisk[];
  evidence: EvidenceItem[];
  inferFiles: (risk: AnalysisRisk) => string[];
  onFocusRisk: (risk: AnalysisRisk) => void;
}

export function RisksTab({
  risks,
  evidence,
  inferFiles,
  onFocusRisk,
}: RisksTabProps) {
  return (
    <div className="space-y-3">
      {/* Risk Register Header */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            Risk & Security Register
          </h4>
        </div>

        {risks.length === 0 ? (
          <p className="text-xs text-zinc-400">No critical risks flagged for this repository.</p>
        ) : (
          <div className="space-y-3">
            {risks.slice(0, 8).map((risk, idx) => {
              const files = inferFiles(risk);
              const severityColor =
                risk.severity === 'high'
                  ? 'text-rose-300 border-rose-500/30 bg-rose-500/10'
                  : risk.severity === 'medium'
                  ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                  : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';

              const riskPercent =
                risk.percentage ||
                (risk.severity === 'high' ? 78 : risk.severity === 'medium' ? 48 : 22);

              return (
                <div
                  key={`${risk.title}-${idx}`}
                  className="rounded-xl border border-white/10 bg-zinc-950/60 p-3.5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${severityColor}`}>
                          {risk.severity} Severity
                        </span>
                        {risk.category && (
                          <span className="text-[9px] text-cyan-300 border border-cyan-400/30 bg-cyan-950/30 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
                            {risk.category}
                          </span>
                        )}
                      </div>
                      <h5 className="text-xs font-semibold text-zinc-100">{risk.title}</h5>
                    </div>

                    <span className="text-xs font-bold text-zinc-100 bg-white/5 border border-white/10 px-2 py-0.5 rounded flex-shrink-0">
                      {riskPercent}% Level
                    </span>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed">{risk.detail}</p>

                  <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-400/20 space-y-1 text-xs">
                    <span className="font-bold text-cyan-200 block uppercase tracking-wider text-[9px]">
                      Recommended Mitigation
                    </span>
                    <p className="text-zinc-200 leading-relaxed">{risk.mitigation}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-zinc-400 text-[11px]">
                      Related files: <strong className="text-zinc-200">{files.length}</strong>
                    </span>
                    <button
                      onClick={() => onFocusRisk(risk)}
                      className="px-2.5 py-1 rounded text-[11px] font-medium border border-rose-400/30 text-rose-300 hover:bg-rose-500/10 transition-colors"
                    >
                      Locate files
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Supporting Evidence References */}
      {evidence && evidence.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Evidence References
          </h4>
          <div className="space-y-1.5">
            {evidence.slice(0, 5).map((item, idx) => (
              <div key={idx} className="rounded-lg border border-white/5 bg-white/5 p-2 text-xs">
                <span className="text-[10px] text-cyan-400 font-mono block truncate">
                  {item.filePath}
                </span>
                <p className="text-zinc-300 mt-0.5">{item.finding}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
