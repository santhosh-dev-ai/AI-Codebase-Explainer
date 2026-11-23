'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCcw, Loader2 } from 'lucide-react';
import type { Node as FlowNode, Edge as FlowEdge } from 'reactflow';
import type { ArchitectureOverview, AnalysisRisk } from '@/types/analysis.types';
import type { RightPanelTab, ScoreItem } from './workspace.types';
import { OverviewTab } from './OverviewTab';
import { ArchitectureTab } from './ArchitectureTab';
import { InsightsTab } from './InsightsTab';
import { RisksTab } from './RisksTab';
import { DashboardTab } from './DashboardTab';

interface InsightsPaneProps {
  activeTab: RightPanelTab;
  onSelectTab: (tab: RightPanelTab) => void;
  isLoading: boolean;
  error: string;
  onRetry: () => void;
  overview: ArchitectureOverview | null;
  reportScores: ScoreItem[];
  highComplexityFiles: string[];
  architectureGraph: { nodes: FlowNode[]; edges: FlowEdge[] };
  dashboardData: {
    totalFiles: number;
    totalFolders: number;
    estimatedLoc: number;
    dominantLanguage: string;
    languageChart: Array<{ name: string; value: number; color: string }>;
    filesPerFolderData: Array<{ folder: string; files: number }>;
    complexityData: Array<{ path: string; complexity: number }>;
    folderTreemapData: Array<{ name: string; size: number }>;
    riskBreakdown: { high: number; medium: number; low: number };
  };
  inferRiskFilesForAction: (risk: AnalysisRisk) => string[];
  onFocusComplexity: () => void;
  onFocusModule: (path: string) => void;
  onFocusFile: (path: string) => void;
  onFocusRisk: (risk: AnalysisRisk) => void;
}

export function InsightsPane({
  activeTab,
  onSelectTab,
  isLoading,
  error,
  onRetry,
  overview,
  reportScores,
  highComplexityFiles,
  architectureGraph,
  dashboardData,
  inferRiskFilesForAction,
  onFocusComplexity,
  onFocusModule,
  onFocusFile,
  onFocusRisk,
}: InsightsPaneProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-950/70 border-l border-white/10 select-none overflow-hidden">
      {/* Tab Navigation Bar */}
      <div className="px-3 pt-2.5 pb-2 border-b border-white/10 bg-white/5 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Repository Analytics</span>
        </div>

        <div className="grid grid-cols-5 gap-1 p-0.5 rounded-lg bg-zinc-900/80 border border-white/10">
          <TabButton
            label="Overview"
            active={activeTab === 'overview'}
            onClick={() => onSelectTab('overview')}
          />
          <TabButton
            label="Arch"
            active={activeTab === 'architecture'}
            onClick={() => onSelectTab('architecture')}
          />
          <TabButton
            label="Insights"
            active={activeTab === 'insights'}
            onClick={() => onSelectTab('insights')}
          />
          <TabButton
            label="Risks"
            active={activeTab === 'risks'}
            onClick={() => onSelectTab('risks')}
          />
          <TabButton
            label="Metrics"
            active={activeTab === 'dashboard'}
            onClick={() => onSelectTab('dashboard')}
          />
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-3 scroll-smooth momentum-scroll">
        {activeTab === 'dashboard' ? (
          <DashboardTab
            totalFiles={dashboardData.totalFiles}
            totalFolders={dashboardData.totalFolders}
            estimatedLoc={dashboardData.estimatedLoc}
            dominantLanguage={dashboardData.dominantLanguage}
            languageChart={dashboardData.languageChart}
            filesPerFolderData={dashboardData.filesPerFolderData}
            complexityData={dashboardData.complexityData}
            folderTreemapData={dashboardData.folderTreemapData}
            riskBreakdown={dashboardData.riskBreakdown}
          />
        ) : isLoading ? (
          <div className="space-y-3 p-3">
            {[...Array(5)].map((_, idx) => (
              <div
                key={idx}
                className="h-3.5 rounded bg-white/10 animate-pulse"
                style={{ width: `${70 + (idx % 3) * 12}%` }}
              />
            ))}
            <div className="flex items-center gap-2 pt-2 text-xs text-cyan-300">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing architecture and dependencies...</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
            <p className="text-xs text-amber-200">{error}</p>
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 border border-white/20 text-zinc-100 transition-colors"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Retry Analysis
            </button>
          </div>
        ) : overview ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'overview' && (
                <OverviewTab
                  overview={overview}
                  reportScores={reportScores}
                  onFocusComplexity={onFocusComplexity}
                  onFocusModule={onFocusModule}
                />
              )}

              {activeTab === 'architecture' && (
                <ArchitectureTab
                  nodes={architectureGraph.nodes}
                  edges={architectureGraph.edges}
                  keyModules={overview.keyModules || []}
                  onFocusModule={onFocusModule}
                />
              )}

              {activeTab === 'insights' && (
                <InsightsTab
                  overview={overview}
                  highComplexityFiles={highComplexityFiles}
                  onFocusComplexity={onFocusComplexity}
                  onFocusFile={onFocusFile}
                />
              )}

              {activeTab === 'risks' && (
                <RisksTab
                  risks={overview.risks || []}
                  evidence={overview.evidence || []}
                  inferFiles={inferRiskFilesForAction}
                  onFocusRisk={onFocusRisk}
                />
              )}
            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>
    </div>
  );
}

function TabButton({
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
      className={`py-1 rounded-md text-[11px] font-medium transition-all ${
        active
          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}
