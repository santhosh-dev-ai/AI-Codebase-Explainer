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
} from 'lucide-react';

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
}: MetricsCenterViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 font-mono text-xs select-none">
      {/* SECTION 1: PHYSICAL REPOSITORY TELEMETRY */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Repository Inventory Telemetry</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">EXTRACTED DIRECTLY FROM SOURCE FILES</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1 hover:border-cyan-400/30 transition-all">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
              <FileSearch className="w-4 h-4 text-cyan-400" />
              <span>Total Files</span>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{totalFiles}</p>
          </div>

          <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1 hover:border-emerald-400/30 transition-all">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Total Folders</span>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{totalFolders}</p>
          </div>

          <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1 hover:border-amber-400/30 transition-all">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
              <Code2 className="w-4 h-4 text-amber-400" />
              <span>Estimated LOC</span>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{estimatedLoc.toLocaleString()}</p>
          </div>

          <div className="p-4 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-1 hover:border-indigo-400/30 transition-all">
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
              <PieChartIcon className="w-4 h-4 text-indigo-400" />
              <span>Top Language</span>
            </div>
            <p className="text-2xl font-bold text-cyan-300 tracking-tight truncate">{dominantLanguage}</p>
          </div>
        </div>
      </div>

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
            <span>Code Quality & Risk Telemetry</span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">STATIC CODE COMPLEXITY & RISK CLUSTERS</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Complexity by File (Horizontal Bar Chart) */}
          <div className="lg:col-span-8 p-5 rounded-2xl border border-white/10 bg-surface/60 backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white">
                  Relative File Complexity (LOC + Nesting)
                </h4>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">AST weighted metrics</span>
            </div>

            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={complexityData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis type="category" dataKey="path" width={140} tick={{ fill: '#cbd5e1', fontSize: 10 }} />
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
