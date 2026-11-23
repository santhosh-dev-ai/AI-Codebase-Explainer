'use client';

import React from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Edge as FlowEdge,
  type Node as FlowNode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Layers, Network } from 'lucide-react';
import type { KeyModule } from '@/types/analysis.types';

interface ArchitectureTabProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  keyModules: KeyModule[];
  onFocusModule: (path: string) => void;
}

export function ArchitectureTab({
  nodes,
  edges,
  keyModules,
  onFocusModule,
}: ArchitectureTabProps) {
  return (
    <div className="space-y-3">
      {/* Interactive ReactFlow Diagram */}
      <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-100">
            System Data Flow
          </h4>
        </div>

        <div className="h-64 rounded-xl border border-white/10 overflow-hidden bg-zinc-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} className="bg-zinc-900 border-white/10 text-white" />
            <Background gap={18} color="#27272a" />
          </ReactFlow>
        </div>
      </div>

      {/* Module Relationships & Boundaries */}
      <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Module Boundaries & Relationships
          </h4>
        </div>

        <div className="space-y-1.5">
          {(keyModules || []).slice(0, 8).map((module, idx) => (
            <button
              key={`${module.path}-${idx}`}
              onClick={() => onFocusModule(module.path)}
              className="w-full rounded-lg border border-white/5 bg-white/5 p-2 text-left hover:border-cyan-400/30 hover:bg-cyan-500/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-100 font-medium">{module.name}</span>
                <span className="text-[10px] text-cyan-400 font-mono truncate max-w-[150px]">
                  {module.path}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">{module.responsibility}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
