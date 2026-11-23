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
  Treemap,
} from 'recharts';
import {
  FileSearch,
  Layers,
  Code2,
  PieChart as PieChartIcon,
  BarChart3,
  BrainCircuit,
} from 'lucide-react';

interface DashboardTabProps {
  totalFiles: number;
  totalFolders: number;
  estimatedLoc: number;
  dominantLanguage: string;
  languageChart: Array<{ name: string; value: number; color: string }>;
  filesPerFolderData: Array<{ folder: string; files: number }>;
  complexityData: Array<{ path: string; complexity: number }>;
  folderTreemapData: Array<{ name: string; size: number }>;
  riskBreakdown: { high: number; medium: number; low: number };
}

export function DashboardTab({
  totalFiles,
  totalFolders,
  estimatedLoc,
  dominantLanguage,
  languageChart,
  filesPerFolderData,
  complexityData,
  folderTreemapData,
  riskBreakdown,
}: DashboardTabProps) {
  return (
    <div className="space-y-3.5">
      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-2.5">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
            <FileSearch className="w-3.5 h-3.5 text-cyan-400" />
            <span>Total Files</span>
          </div>
          <p className="text-base font-bold text-zinc-100 mt-1">{totalFiles}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-2.5">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Folders</span>
          </div>
          <p className="text-base font-bold text-zinc-100 mt-1">{totalFolders}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-2.5">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
            <Code2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Estimated LOC</span>
          </div>
          <p className="text-base font-bold text-zinc-100 mt-1">{estimatedLoc.toLocaleString()}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-2.5">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
            <PieChartIcon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Top Language</span>
          </div>
          <p className="text-base font-bold text-cyan-300 mt-1 truncate">{dominantLanguage}</p>
        </div>
      </div>

      {/* Language Distribution */}
      <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <PieChartIcon className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            Language Distribution
          </h4>
        </div>
        <div className="h-48 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={languageChart}
                dataKey="value"
                nameKey="name"
                outerRadius={68}
                innerRadius={42}
                paddingAngle={4}
              >
                {languageChart.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="rgba(15,23,42,0.8)" strokeWidth={2} />
                ))}
              </Pie>
              <RechartsTooltip
                contentStyle={{
                  background: 'rgba(9, 9, 11, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] uppercase text-zinc-500 font-semibold tracking-wider">Top</span>
            <span className="text-xs font-bold text-cyan-200">{dominantLanguage}</span>
          </div>
        </div>
      </div>

      {/* Files Per Folder */}
      <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            Files Per Folder
          </h4>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filesPerFolderData} margin={{ left: -15, right: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="folder" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} />
              <RechartsTooltip
                contentStyle={{
                  background: 'rgba(9, 9, 11, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="files" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Complexity by File */}
      <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <BrainCircuit className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            Complexity by File
          </h4>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={complexityData} layout="vertical" margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
              <YAxis type="category" dataKey="path" width={100} tick={{ fill: '#e4e4e7', fontSize: 9 }} />
              <RechartsTooltip
                contentStyle={{
                  background: 'rgba(9, 9, 11, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="complexity" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Folder Treemap */}
      <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            Directory Scale
          </h4>
        </div>
        <div className="h-40 rounded-lg overflow-hidden border border-white/5">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={folderTreemapData}
              dataKey="size"
              stroke="rgba(9, 9, 11, 0.9)"
              fill="#3b82f6"
              animationDuration={400}
            />
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk Breakdown Tiles */}
      <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Risk Breakdown
        </h4>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200">
            <span className="text-[10px] opacity-75 block">High</span>
            <span className="text-sm font-bold mt-0.5 block">{riskBreakdown.high}</span>
          </div>
          <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200">
            <span className="text-[10px] opacity-75 block">Medium</span>
            <span className="text-sm font-bold mt-0.5 block">{riskBreakdown.medium}</span>
          </div>
          <div className="p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
            <span className="text-[10px] opacity-75 block">Low</span>
            <span className="text-sm font-bold mt-0.5 block">{riskBreakdown.low}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
