'use client';

import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  FileSearch,
  Layers,
  Code2,
  PieChart as PieChartIcon,
  BarChart3,
  BrainCircuit,
  ShieldAlert,
  Server,
  Binary,
  FlaskConical,
  FileCode2,
} from 'lucide-react';
import type { RepositoryMetrics } from '@/types/analysis.types';

interface MetricsCenterViewProps {
  totalFiles: number;
  totalFolders: number;
  estimatedLoc: number;
  dominantLanguage: string;
  languageChart: Array<{ name: string; value: number; color: string }>;
  filesPerFolderData: Array<{ folder: string; files: number }>;
  complexityData: Array<{ path: string; complexity: number }>;
  folderTreemapData?: Array<{ name: string; size: number }>;
  riskBreakdown: { high: number; medium: number; low: number };
  codeMetrics?: RepositoryMetrics;
}

export function MetricsCenterView({
  totalFiles,
  totalFolders,
  estimatedLoc,
  dominantLanguage,
  languageChart,
  filesPerFolderData,
  complexityData,
  riskBreakdown,
  codeMetrics,
}: MetricsCenterViewProps) {
  const isLocMeasured = codeMetrics?.summary?.locProvenance === 'measured';
  const displayLoc = isLocMeasured
    ? codeMetrics!.summary.codeLines
    : estimatedLoc;

  const testIntel = codeMetrics?.testIntelligence;
  const complexitySummary = codeMetrics?.complexity;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 font-mono text-xs select-none">
      {/* SECTION 1: PHYSICAL REPOSITORY TELEMETRY */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Repository Inventory Telemetry</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            {isLocMeasured ? 'PARSED DIRECTLY FROM SOURCE CODE' : 'ESTIMATED FROM REPOSITORY ARTIFACTS'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1 hover:border-cyan-400/30 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <FileSearch className="w-4 h-4 text-cyan-400" />
                <span>Total Files</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Measured
              </span>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{totalFiles}</p>
            <p className="text-[10px] text-zinc-500">Indexed source & config files</p>
          </div>

          <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1 hover:border-emerald-400/30 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Total Folders</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Measured
              </span>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{totalFolders}</p>
            <p className="text-[10px] text-zinc-500">Directory tree structure</p>
          </div>

          <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1 hover:border-amber-400/30 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <Code2 className="w-4 h-4 text-amber-400" />
                <span>{isLocMeasured ? 'Code Lines (LOC)' : 'Estimated LOC'}</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] border ${
                  isLocMeasured
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                }`}
              >
                {isLocMeasured ? 'Measured' : 'Estimated'}
              </span>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{displayLoc.toLocaleString()}</p>
            <p className="text-[10px] text-zinc-500">
              {isLocMeasured
                ? `${codeMetrics?.summary?.totalLines.toLocaleString()} total physical lines`
                : 'Heuristic byte estimate'}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1 hover:border-indigo-400/30 transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <PieChartIcon className="w-4 h-4 text-indigo-400" />
                <span>Top Language</span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Measured
              </span>
            </div>
            <p className="text-2xl font-bold text-cyan-300 tracking-tight truncate">{dominantLanguage}</p>
            <p className="text-[10px] text-zinc-500">Dominant codebase ecosystem</p>
          </div>
        </div>

        {/* ACCURATE LINES OF CODE BREAKDOWN SUB-PANEL */}
        {codeMetrics?.summary && (
          <div className="p-4 rounded-2xl border border-white/10 bg-surface/40 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                  Language-Aware Lines of Code Breakdown
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Exact Syntax Parse
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl border border-white/5 bg-black/20 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Executable Code</span>
                <p className="text-lg font-bold text-emerald-300">{codeMetrics.summary.codeLines.toLocaleString()}</p>
                <p className="text-[9px] text-zinc-500">Excludes pure comments</p>
              </div>

              <div className="p-3 rounded-xl border border-white/5 bg-black/20 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Comments</span>
                <p className="text-lg font-bold text-cyan-300">{codeMetrics.summary.commentLines.toLocaleString()}</p>
                <p className="text-[9px] text-zinc-500">Single & block comments</p>
              </div>

              <div className="p-3 rounded-xl border border-white/5 bg-black/20 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Blank Lines</span>
                <p className="text-lg font-bold text-zinc-300">{codeMetrics.summary.blankLines.toLocaleString()}</p>
                <p className="text-[9px] text-zinc-500">Whitespace formatting</p>
              </div>

              <div className="p-3 rounded-xl border border-white/5 bg-black/20 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Mixed Lines</span>
                <p className="text-lg font-bold text-amber-300">{codeMetrics.summary.mixedLines.toLocaleString()}</p>
                <p className="text-[9px] text-zinc-500">Inline code + comments</p>
              </div>

              <div className="p-3 rounded-xl border border-white/5 bg-black/20 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Total Physical</span>
                <p className="text-lg font-bold text-white">{codeMetrics.summary.totalLines.toLocaleString()}</p>
                <p className="text-[9px] text-zinc-500">Code + Blank + Comments</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1B: TEST INTELLIGENCE */}
      {testIntel && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
              <span>Test Intelligence & Coverage Status</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">STATIC FRAMEWORK & TEST DISCOVERY</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Test Files Detected</span>
              <p className="text-2xl font-bold text-purple-300">{testIntel.testFilesDetected}</p>
              <p className="text-[10px] text-zinc-500">Matched directory & naming specs</p>
            </div>

            <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Test Cases Detected</span>
              <p className="text-2xl font-bold text-purple-300">{testIntel.testCasesDetected}</p>
              <p className="text-[10px] text-zinc-500">Parsed it(), test(), def test_*</p>
            </div>

            <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Frameworks Detected</span>
              <p className="text-base font-bold text-white truncate">
                {testIntel.testFrameworks.length > 0 ? testIntel.testFrameworks.join(', ') : 'None Detected'}
              </p>
              <p className="text-[10px] text-zinc-500">Jest, Vitest, Pytest, JUnit, etc.</p>
            </div>

            <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Execution & Coverage</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] border ${
                    testIntel.coverage.available
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                  }`}
                >
                  {testIntel.coverage.available ? 'Report Parsed' : 'Not Available'}
                </span>
              </div>
              <p className="text-base font-bold text-zinc-300">
                {testIntel.coverage.available ? `${testIntel.coverage.percentage}% Line Coverage` : 'Static Analysis Only'}
              </p>
              <p className="text-[10px] text-zinc-500 truncate" title={testIntel.coverage.reason}>
                {testIntel.coverage.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: TOPOLOGICAL DISTRIBUTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <Binary className="w-3.5 h-3.5 text-emerald-400" />
            <span>Topological Distribution</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">AST & DIRECTORY STRUCTURE</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Language Breakdown */}
          <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                  Language Distribution
                </h4>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">{languageChart.length} languages detected</span>
            </div>

            <div className="h-56 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={languageChart}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={85}
                    innerRadius={55}
                    paddingAngle={4}
                  >
                    {languageChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="rgba(7,9,14,0.9)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      background: '#0f1420',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Dominant</span>
                <span className="text-sm font-bold text-cyan-200">{dominantLanguage}</span>
              </div>
            </div>
          </div>

          {/* Files per Folder */}
          <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                  Directory Density
                </h4>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">Files per top-level folder</span>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filesPerFolderData} margin={{ left: -15, right: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="folder" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <RechartsTooltip
                    contentStyle={{
                      background: '#0f1420',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Bar dataKey="files" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: CODE QUALITY & RISK PROFILE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <BrainCircuit className="w-3.5 h-3.5 text-amber-400" />
            <span>Code Quality & Complexity Telemetry</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            {complexitySummary?.status === 'measured' ? 'AST MCCABE CYCLOMATIC MEASUREMENT' : 'ESTIMATED HEURISTICS'}
          </span>
        </div>

        {/* MCCABE DISTRIBUTION BADGES */}
        {complexitySummary?.distribution && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-white/10 bg-surface/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-400 font-semibold uppercase">Low Complexity (&le;5)</span>
                <p className="text-[9px] text-zinc-500">Clean control flow</p>
              </div>
              <span className="text-base font-bold text-emerald-300 font-mono">
                {complexitySummary.distribution.low}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-white/10 bg-surface/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-amber-400 font-semibold uppercase">Moderate (6-10)</span>
                <p className="text-[9px] text-zinc-500">Moderate nesting</p>
              </div>
              <span className="text-base font-bold text-amber-300 font-mono">
                {complexitySummary.distribution.medium}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-white/10 bg-surface/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-rose-400 font-semibold uppercase">High Complexity (&gt;10)</span>
                <p className="text-[9px] text-zinc-500">Refactoring targets</p>
              </div>
              <span className="text-base font-bold text-rose-300 font-mono">
                {complexitySummary.distribution.high}
              </span>
            </div>

            <div className="p-3 rounded-xl border border-white/10 bg-surface/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-cyan-400 font-semibold uppercase">Avg per Function</span>
                <p className="text-[9px] text-zinc-500">Across {complexitySummary.totalFunctionsCount} functions</p>
              </div>
              <span className="text-base font-bold text-cyan-300 font-mono">
                {complexitySummary.averagePerFunction}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Complexity by File (Horizontal Bar Chart) */}
          <div className="lg:col-span-8 p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                  Relative File Complexity (McCabe Cyclomatic)
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                {complexitySummary?.status === 'measured' ? 'AST Branch Measurement' : 'AST Weighted Metrics'}
              </span>
            </div>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={complexityData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis type="category" dataKey="path" width={160} tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                  <RechartsTooltip
                    contentStyle={{
                      background: '#0f1420',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <Bar dataKey="complexity" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Risk Breakdown Summary */}
          <div className="lg:col-span-4 p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-4 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                  Risk Category Register
                </h4>
              </div>
              <p className="text-[11px] text-zinc-400 font-sans">
                Aggregated findings categorized by operational impact.
              </p>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-200">High Impact</span>
                <span className="text-base font-bold text-rose-300 font-mono">{riskBreakdown.high}</span>
              </div>
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-200">Medium Impact</span>
                <span className="text-base font-bold text-amber-300 font-mono">{riskBreakdown.medium}</span>
              </div>
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-200">Low Impact / Advisory</span>
                <span className="text-base font-bold text-emerald-300 font-mono">{riskBreakdown.low}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
