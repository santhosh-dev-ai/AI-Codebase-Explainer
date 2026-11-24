'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  FileCode2,
  Lightbulb,
  X,
  RefreshCcw,
  Flame,
} from 'lucide-react';
import type { ArchitectureOverview, AnalysisRisk, FileExplanation, KeyModule } from '@/types/analysis.types';
import type { InspectorTab, ScoreItem } from './workspace.types';
import { ThoughtLine } from '@/components/react-bits';

interface UnifiedAIInspectorProps {
  activeTab: InspectorTab;
  onSelectTab: (tab: InspectorTab) => void;
  selectedFilePath?: string;
  fileInsight: FileExplanation | null;
  isLoadingFileInsight: boolean;
  fileInsightError: string;
  onRetryFileInsight: () => void;
  overview: ArchitectureOverview | null;
  isLoadingOverview: boolean;
  overviewError: string;
  onRetryOverview: () => void;
  reportScores: ScoreItem[];
  highComplexityFiles: string[];
  keyModules: KeyModule[];
  onFocusFile: (path: string) => void;
  onFocusRisk: (risk: AnalysisRisk) => void;
  onFocusComplexity: () => void;
  inferRiskFiles: (risk: AnalysisRisk) => string[];
  onClose: () => void;
}

export function UnifiedAIInspector({
  activeTab,
  onSelectTab,
  selectedFilePath,
  fileInsight,
  isLoadingFileInsight,
  fileInsightError,
  onRetryFileInsight,
  overview,
  isLoadingOverview: _isLoadingOverview,
  overviewError: _overviewError,
  onRetryOverview: _onRetryOverview,
  reportScores,
  highComplexityFiles,
  keyModules,
  onFocusFile,
  onFocusRisk,
  onFocusComplexity,
  inferRiskFiles: _inferRiskFiles,
  onClose,
}: UnifiedAIInspectorProps) {
  const fileName = selectedFilePath ? selectedFilePath.split('/').pop() : null;

  return (
    <aside className="flex flex-col h-full bg-void/90 border-l border-white/10 select-none overflow-hidden font-mono text-xs">
      {/* Inspector Header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-white/10 bg-surface/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-zinc-300 font-semibold tracking-wider uppercase text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Inspector</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Context Badge: File-specific vs Repo-level */}
            {selectedFilePath ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 max-w-[120px] truncate">
                {fileName}
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
                Global
              </span>
            )}

            <button
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded transition-colors"
              title="Close inspector"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 5 Clean Tabs: Explain, Architecture, Insights, Risks, Overview */}
        <div className="grid grid-cols-5 gap-1 p-0.5 rounded-lg bg-void border border-white/10">
          <InspectorTabButton
            active={activeTab === 'explain'}
            onClick={() => onSelectTab('explain')}
            label="Explain"
          />
          <InspectorTabButton
            active={activeTab === 'architecture'}
            onClick={() => onSelectTab('architecture')}
            label="Arch"
          />
          <InspectorTabButton
            active={activeTab === 'insights'}
            onClick={() => onSelectTab('insights')}
            label="Insights"
          />
          <InspectorTabButton
            active={activeTab === 'risks'}
            onClick={() => onSelectTab('risks')}
            label="Risks"
          />
          <InspectorTabButton
            active={activeTab === 'overview'}
            onClick={() => onSelectTab('overview')}
            label="Overview"
          />
        </div>
      </div>

      {/* Inspector Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3 scroll-smooth">
        <AnimatePresence mode="wait">
          {/* TAB 1: EXPLAIN (Contextual to selected file) */}
          {activeTab === 'explain' && (
            <motion.div
              key="explain-tab"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {!selectedFilePath ? (
                <div className="p-4 rounded-xl border border-white/5 bg-surface/40 text-center space-y-2">
                  <FileCode2 className="w-8 h-8 text-zinc-500 mx-auto" />
                  <h4 className="text-xs font-semibold text-zinc-200">No file selected</h4>
                  <p className="text-[11px] text-zinc-400 font-sans">
                    Click any file in Explorer or from the Architecture view to inspect functions, parameters, and purpose.
                  </p>
                </div>
              ) : isLoadingFileInsight ? (
                <div className="space-y-3 p-2">
                  <ThoughtLine
                    isThinking={true}
                    label="Parsing AST symbols & signatures..."
                    variant="cyan"
                  />
                  <div className="h-3 rounded bg-white/5 animate-pulse w-full" />
                  <div className="h-3 rounded bg-white/5 animate-pulse w-5/6" />
                </div>
              ) : fileInsightError ? (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                  <p className="text-xs text-amber-200">{fileInsightError}</p>
                  <button
                    onClick={onRetryFileInsight}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-white/10 hover:bg-white/15 text-white transition-colors"
                  >
                    <RefreshCcw className="w-3 h-3" />
                    <span>Retry Analysis</span>
                  </button>
                </div>
              ) : fileInsight ? (
                <>
                  {/* File Purpose */}
                  <div className="p-3 rounded-xl border border-white/10 bg-surface/80 space-y-1">
                    <span className="text-[10px] font-bold text-cyan-300 tracking-wider uppercase block">
                      Purpose
                    </span>
                    <p className="text-xs text-zinc-200 leading-relaxed font-sans">
                      {fileInsight.purpose}
                    </p>
                  </div>

                  {/* Key Functions / Classes */}
                  {fileInsight.keyFunctions && fileInsight.keyFunctions.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Functions & Classes ({fileInsight.keyFunctions.length})
                      </span>
                      <div className="space-y-1.5">
                        {fileInsight.keyFunctions.map((fn, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-lg border border-white/5 bg-surface/50 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-cyan-300 truncate">
                                {fn.name}
                              </span>
                              {fn.lineStart && (
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  L{fn.lineStart}{fn.lineEnd ? `-${fn.lineEnd}` : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-300 font-sans leading-snug">
                              {fn.description}
                            </p>
                            {fn.parameters && fn.parameters.length > 0 && (
                              <div className="text-[10px] text-zinc-400 font-mono">
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

                  {/* Patterns & Observations */}
                  {fileInsight.patterns && fileInsight.patterns.length > 0 && (
                    <div className="p-3 rounded-xl border border-white/10 bg-surface/50 space-y-1.5">
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block flex items-center gap-1">
                        <Lightbulb className="w-3 h-3 text-amber-400" />
                        Patterns & Observations
                      </span>
                      <ul className="space-y-1 text-[11px] text-zinc-300 font-sans">
                        {fileInsight.patterns.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-mono">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Imports & Dependencies */}
                  {fileInsight.dependencies && fileInsight.dependencies.length > 0 && (
                    <div className="p-3 rounded-xl border border-white/10 bg-surface/50 space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                        Imports ({fileInsight.dependencies.length})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {fileInsight.dependencies.map((dep, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/5 text-zinc-300 truncate max-w-full"
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 text-center text-zinc-500 text-xs">
                  No analysis generated yet for this file.
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <motion.div
              key="arch-tab"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {overview?.pattern && (
                <div className="p-3 rounded-xl border border-white/10 bg-surface/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    Architectural Pattern
                  </span>
                  <p className="text-xs text-zinc-100 font-semibold">{overview.pattern}</p>
                  <p className="text-[11px] text-zinc-400 font-sans mt-1">
                    {overview.projectType} · {overview.framework || 'Standard runtime'}
                  </p>
                </div>
              )}

              {/* Data Flow Description */}
              {overview?.dataFlow && (
                <div className="p-3 rounded-xl border border-white/10 bg-surface/60 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    System Data Flow
                  </span>
                  <p className="text-xs text-zinc-300 font-sans leading-relaxed whitespace-pre-line">
                    {overview.dataFlow}
                  </p>
                </div>
              )}

              {/* Key Modules */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Key Modules ({keyModules.length})
                </span>
                {keyModules.slice(0, 6).map((module, idx) => (
                  <button
                    key={`${module.path}-${idx}`}
                    onClick={() => onFocusFile(module.path)}
                    className="w-full text-left p-2 rounded-lg border border-white/5 bg-surface/50 hover:border-cyan-400/30 hover:bg-cyan-500/10 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-200 font-semibold truncate">{module.name}</span>
                      <span className="text-[10px] text-cyan-400 font-mono truncate max-w-[120px]">
                        {module.path.split('/').pop()}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans line-clamp-2">
                      {module.responsibility}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 3: INSIGHTS */}
          {activeTab === 'insights' && (
            <motion.div
              key="insights-tab"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {/* Complexity Hot Spots */}
              <div className="p-3 rounded-xl border border-white/10 bg-surface/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-semibold text-zinc-100">Complexity Hot Spots</span>
                  </div>
                  <button
                    onClick={onFocusComplexity}
                    className="text-[10px] px-2 py-0.5 rounded border border-amber-400/30 text-amber-300 hover:bg-amber-400/10"
                  >
                    Focus All
                  </button>
                </div>

                {highComplexityFiles.length === 0 ? (
                  <p className="text-[11px] text-zinc-400 font-sans">No high-complexity hot spots flagged.</p>
                ) : (
                  <div className="space-y-1">
                    {highComplexityFiles.slice(0, 5).map((path, idx) => (
                      <button
                        key={idx}
                        onClick={() => onFocusFile(path)}
                        className="w-full text-left p-1.5 rounded bg-void border border-white/5 hover:border-cyan-400/30 text-[11px] text-zinc-300 truncate"
                      >
                        {path}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Maintainability Observations */}
              {overview?.executiveBullets && overview.executiveBullets.length > 0 && (
                <div className="p-3 rounded-xl border border-white/10 bg-surface/60 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block">
                    Observations & Recommendations
                  </span>
                  <ul className="space-y-1.5 text-xs text-zinc-300 font-sans">
                    {overview.executiveBullets.slice(0, 4).map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-cyan-400 font-mono">•</span>
                        <span className="leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 4: RISKS */}
          {activeTab === 'risks' && (
            <motion.div
              key="risks-tab"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {(overview?.risks || []).length === 0 ? (
                <div className="p-4 rounded-xl border border-white/5 bg-surface/40 text-center text-xs text-zinc-400">
                  No critical risks recorded.
                </div>
              ) : (
                (overview?.risks || []).slice(0, 6).map((risk, idx) => {
                  const severityStyle =
                    risk.severity === 'high'
                      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                      : risk.severity === 'medium'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-white/10 bg-surface/60 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${severityStyle}`}>
                            {risk.severity}
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
                            INFERRED
                          </span>
                        </div>
                        <button
                          onClick={() => onFocusRisk(risk)}
                          className="text-[10px] text-cyan-400 hover:underline"
                        >
                          Locate Files
                        </button>
                      </div>

                      <h5 className="text-xs font-semibold text-zinc-100">{risk.title}</h5>
                      <p className="text-[11px] text-zinc-300 font-sans leading-relaxed">
                        {risk.detail}
                      </p>

                      {risk.mitigation && (
                        <div className="p-2 rounded bg-void border border-white/5 text-[11px] text-zinc-400 font-sans">
                          <strong className="text-cyan-300">Mitigation: </strong>
                          {risk.mitigation}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* TAB 5: OVERVIEW */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview-tab"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {/* Executive Summary */}
              {overview?.summary && (
                <div className="p-3 rounded-xl border border-white/10 bg-surface/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 block">
                    Repository Summary
                  </span>
                  <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                    {overview.summary}
                  </p>
                </div>
              )}

              {/* Scorecard Meters */}
              {reportScores.length > 0 && (
                <div className="p-3 rounded-xl border border-white/10 bg-surface/60 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 block">
                    Quality Scores
                  </span>
                  <div className="space-y-2">
                    {reportScores.map((score) => {
                      const clamped = Math.max(0, Math.min(100, Math.round(score.value)));
                      return (
                        <div key={score.key} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-400 capitalize">{score.key}</span>
                            <span className="font-semibold text-zinc-100">{clamped}/100</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-void border border-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 ease-out"
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
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}

function InspectorTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-1 rounded text-[10px] font-mono transition-all text-center ${
        active
          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-semibold'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}
