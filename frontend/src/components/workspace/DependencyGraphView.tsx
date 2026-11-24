'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  type Node as FlowNode,
  type NodeProps,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Search,
  RotateCcw,
  Maximize2,
  Play,
  Pause,
  SkipForward,
  X,
  ExternalLink,
  Cpu,
  Layers,
  Database,
  Sliders,
  Sparkles,
  Settings,
  FileCode,
  Zap,
  Navigation,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import type {
  DependencyGraphData,
  DependencyGraphNode,
  DependencyNodeType,
} from '@/types/analysis.types';
import { LatticeLoader } from '@/components/react-bits/LatticeLoader';

interface DependencyGraphViewProps {
  sessionId: string;
  onNavigateToFile: (path: string) => void;
  className?: string;
}

// Visual Theme Configuration for Node Types
const NODE_THEMES: Record<
  DependencyNodeType,
  {
    bg: string;
    border: string;
    text: string;
    glow: string;
    badgeBg: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  entry: {
    bg: 'bg-cyan-950/60',
    border: 'border-cyan-500/50',
    text: 'text-cyan-300',
    glow: 'rgba(34, 211, 238, 0.4)',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    icon: Zap,
    label: 'Entry Point',
  },
  route: {
    bg: 'bg-blue-950/60',
    border: 'border-blue-500/50',
    text: 'text-blue-300',
    glow: 'rgba(59, 130, 246, 0.4)',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: Navigation,
    label: 'Route / API',
  },
  controller: {
    bg: 'bg-violet-950/60',
    border: 'border-violet-500/50',
    text: 'text-violet-300',
    glow: 'rgba(168, 85, 247, 0.4)',
    badgeBg: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    icon: Sliders,
    label: 'Controller',
  },
  service: {
    bg: 'bg-emerald-950/60',
    border: 'border-emerald-500/50',
    text: 'text-emerald-300',
    glow: 'rgba(16, 185, 129, 0.4)',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: Cpu,
    label: 'Service',
  },
  component: {
    bg: 'bg-pink-950/60',
    border: 'border-pink-500/50',
    text: 'text-pink-300',
    glow: 'rgba(236, 72, 153, 0.4)',
    badgeBg: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    icon: Layers,
    label: 'Component / View',
  },
  storage: {
    bg: 'bg-orange-950/60',
    border: 'border-orange-500/50',
    text: 'text-orange-300',
    glow: 'rgba(249, 115, 22, 0.4)',
    badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    icon: Database,
    label: 'Storage / Model',
  },
  ai: {
    bg: 'bg-indigo-950/60',
    border: 'border-indigo-500/50',
    text: 'text-indigo-300',
    glow: 'rgba(99, 102, 241, 0.4)',
    badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    icon: Sparkles,
    label: 'AI / LLM',
  },
  config: {
    bg: 'bg-zinc-900/80',
    border: 'border-zinc-500/40',
    text: 'text-zinc-300',
    glow: 'rgba(113, 113, 122, 0.3)',
    badgeBg: 'bg-zinc-700/30 text-zinc-300 border-zinc-600/30',
    icon: Settings,
    label: 'Config / Manifest',
  },
  utility: {
    bg: 'bg-slate-900/70',
    border: 'border-slate-600/40',
    text: 'text-slate-300',
    glow: 'rgba(148, 163, 184, 0.3)',
    badgeBg: 'bg-slate-800/40 text-slate-300 border-slate-700/40',
    icon: FileCode,
    label: 'Utility',
  },
};

// Custom ReactFlow Node Component
function DependencyCustomNode({ data, selected }: NodeProps) {
  const node = data.node as DependencyGraphNode;
  const isIncoming = data.isIncoming;
  const isOutgoing = data.isOutgoing;
  const isSimActive = data.isSimActive;
  const isDimmed = data.isDimmed;

  const theme = NODE_THEMES[node.type] || NODE_THEMES.utility;
  const IconComponent = theme.icon;

  let borderStyle = theme.border;
  let shadowStyle = `0 0 12px ${theme.glow}`;
  let opacity = 1;

  if (selected || isSimActive) {
    borderStyle = 'border-cyan-400 ring-2 ring-cyan-400/50';
    shadowStyle = '0 0 24px rgba(34, 211, 238, 0.7)';
  } else if (isIncoming) {
    borderStyle = 'border-amber-400 ring-1 ring-amber-400/40';
    shadowStyle = '0 0 16px rgba(245, 158, 11, 0.5)';
  } else if (isOutgoing) {
    borderStyle = 'border-emerald-400 ring-1 ring-emerald-400/40';
    shadowStyle = '0 0 16px rgba(16, 185, 129, 0.5)';
  } else if (isDimmed) {
    opacity = 0.16;
  }

  return (
    <div
      style={{
        opacity,
        boxShadow: shadowStyle,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={`cursor-target relative w-52 rounded-xl border backdrop-blur-xl ${theme.bg} ${borderStyle} p-3 text-left cursor-pointer group hover:scale-[1.02] select-none`}
      data-cursor-label={node.label}
    >
      {/* ReactFlow Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-cyan-400 !border !border-void !-left-1"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-emerald-400 !border !border-void !-right-1"
      />

      {/* Top Row: Type Badge & Status Indicator */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${theme.badgeBg}`}
        >
          <IconComponent className="w-3 h-3" />
          <span>{node.type.toUpperCase()}</span>
        </span>

        <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
          <span>{node.loc} L</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </span>
      </div>

      {/* Center: File Base Name */}
      <div className="font-mono text-xs font-semibold text-white truncate mb-1" title={node.path}>
        {node.label}
      </div>

      {/* Path preview */}
      <div className="text-[10px] text-zinc-400 truncate mb-2 font-mono">
        {node.path}
      </div>

      {/* Bottom Footer: Dependencies telemetry */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
        <span className="flex items-center gap-1 text-amber-300/90" title="Incoming: Imported by">
          <ArrowLeft className="w-2.5 h-2.5" />
          <span>{node.importedBy?.length || 0} in</span>
        </span>
        <span className="flex items-center gap-1 text-emerald-300/90" title="Outgoing: Imports">
          <span>{node.resolvedImports?.length || 0} out</span>
          <ArrowRight className="w-2.5 h-2.5" />
        </span>
      </div>

      {/* Selection pill */}
      {selected && (
        <div className="absolute -top-2.5 right-2 px-1.5 py-0.5 rounded-full bg-cyan-400 text-void text-[9px] font-bold font-mono shadow-md">
          SELECTED
        </div>
      )}
    </div>
  );
}

const customNodeTypes = {
  dependencyNode: DependencyCustomNode,
};

// Wrapper with ReactFlowProvider
export function DependencyGraphView(props: DependencyGraphViewProps) {
  return (
    <ReactFlowProvider>
      <DependencyGraphContent {...props} />
    </ReactFlowProvider>
  );
}

function DependencyGraphContent({
  sessionId,
  onNavigateToFile,
  className = '',
}: DependencyGraphViewProps) {
  const [graphData, setGraphData] = useState<DependencyGraphData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Execution Flow Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(0);

  const { fitView } = useReactFlow();

  // Fetch real dependency graph from backend
  const fetchDependencyGraph = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetch(`http://localhost:3001/api/analysis/${sessionId}/dependencies`);
      if (!response.ok) {
        throw new Error(`Failed to load dependency graph (${response.status})`);
      }
      const data = await response.json();
      if (data?.data?.dependencyGraph) {
        setGraphData(data.data.dependencyGraph);
      } else {
        throw new Error('Malformed dependency graph response');
      }
    } catch (err: any) {
      setError(err?.message || 'Error fetching dependency relationships');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchDependencyGraph();
  }, [fetchDependencyGraph]);

  // Selected Node Details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !graphData) return null;
    return graphData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, graphData]);

  // Immediate Neighbors (Incoming and Outgoing)
  const incomingNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return new Set(selectedNode.importedBy || []);
  }, [selectedNode]);

  const outgoingNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return new Set(selectedNode.resolvedImports || []);
  }, [selectedNode]);

  // Layout Algorithm: Layered Topological Columns
  const initialLayoutNodes = useMemo(() => {
    if (!graphData) return [];

    const rankOrder: Record<DependencyNodeType, number> = {
      entry: 0,
      route: 1,
      controller: 2,
      service: 3,
      ai: 3,
      component: 4,
      storage: 5,
      config: 6,
      utility: 7,
    };

    // Group nodes by architectural rank
    const groups: Record<number, DependencyGraphNode[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    };

    graphData.nodes.forEach((node) => {
      const r = rankOrder[node.type] ?? 7;
      groups[r].push(node);
    });

    const flowNodes: FlowNode[] = [];
    const colSpacing = 280;
    const rowSpacing = 130;

    Object.entries(groups).forEach(([rankStr, nodesInRank]) => {
      const rank = Number(rankStr);
      const x = 60 + rank * colSpacing;

      // Center vertically based on number of nodes in rank
      const totalHeight = nodesInRank.length * rowSpacing;
      const startY = Math.max(60, 400 - totalHeight / 2);

      nodesInRank.forEach((node, idx) => {
        const y = startY + idx * rowSpacing;
        flowNodes.push({
          id: node.id,
          type: 'dependencyNode',
          position: { x, y },
          data: {
            node,
            isIncoming: false,
            isOutgoing: false,
            isSimActive: false,
            isDimmed: false,
          },
        });
      });
    });

    return flowNodes;
  }, [graphData]);

  // Simulation Sequence Generation
  const simSequence = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) return [];

    // Find first entry point
    const entry = graphData.nodes.find((n) => n.type === 'entry') || graphData.nodes[0];
    const steps: { nodeId: string; title: string; description: string }[] = [];

    steps.push({
      nodeId: entry.id,
      title: `1. Bootstrap & Entry Point (${entry.label})`,
      description: `Initializes runtime, loads configuration, and mounts core routing pipeline.`,
    });

    // Walk outgoing dependencies
    let current = entry;
    const visited = new Set<string>([entry.id]);

    for (let step = 2; step <= 6; step++) {
      const nextId = current.resolvedImports.find((id) => !visited.has(id));
      if (!nextId) break;

      const nextNode = graphData.nodes.find((n) => n.id === nextId);
      if (!nextNode) break;

      visited.add(nextId);
      steps.push({
        nodeId: nextId,
        title: `${step}. ${nextNode.type.toUpperCase()}: ${nextNode.label}`,
        description: `Dispatches execution into ${nextNode.path} to handle request processing.`,
      });
      current = nextNode;
    }

    return steps;
  }, [graphData]);

  // Simulation Timer
  useEffect(() => {
    if (!isSimulating || simSequence.length === 0) return;

    const timer = setInterval(() => {
      setSimStepIndex((prev) => (prev + 1) % simSequence.length);
    }, 2400);

    return () => clearInterval(timer);
  }, [isSimulating, simSequence.length]);

  const activeSimNodeId = isSimulating && simSequence[simStepIndex] ? simSequence[simStepIndex].nodeId : null;

  // ReactFlow Nodes with Live State (Selection, Filtering, Dimming, Simulation)
  const displayNodes = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return initialLayoutNodes.map((flowNode) => {
      const node = flowNode.data.node as DependencyGraphNode;

      // Category filter
      const matchesCategory =
        selectedCategory === 'all' || node.type.toLowerCase() === selectedCategory.toLowerCase();

      // Search match
      const matchesSearch =
        !term ||
        node.label.toLowerCase().includes(term) ||
        node.path.toLowerCase().includes(term);

      const isSelected = selectedNodeId === node.id;
      const isIncoming = incomingNodeIds.has(node.id);
      const isOutgoing = outgoingNodeIds.has(node.id);
      const isSimActive = activeSimNodeId === node.id;

      let isDimmed = false;
      if (selectedNodeId) {
        isDimmed = !isSelected && !isIncoming && !isOutgoing;
      } else if (term) {
        isDimmed = !matchesSearch;
      } else if (!matchesCategory) {
        isDimmed = true;
      }

      return {
        ...flowNode,
        data: {
          ...flowNode.data,
          isIncoming,
          isOutgoing,
          isSimActive,
          isDimmed,
        },
      };
    });
  }, [
    initialLayoutNodes,
    searchTerm,
    selectedCategory,
    selectedNodeId,
    incomingNodeIds,
    outgoingNodeIds,
    activeSimNodeId,
  ]);

  // ReactFlow Edges with Directional Highlight Colors
  const displayEdges = useMemo(() => {
    if (!graphData) return [];

    return graphData.edges.map((edge) => {
      const isIncomingToSelected = selectedNodeId !== null && edge.target === selectedNodeId;
      const isOutgoingFromSelected = selectedNodeId !== null && edge.source === selectedNodeId;
      const isSimEdge = activeSimNodeId !== null && (edge.source === activeSimNodeId || edge.target === activeSimNodeId);

      let stroke = 'rgba(255, 255, 255, 0.12)';
      let strokeWidth = 1.2;
      let animated = false;
      let markerColor = '#64748b';

      if (isOutgoingFromSelected) {
        // Outgoing dependency: Cyan / Emerald
        stroke = '#22d3ee';
        strokeWidth = 2.5;
        animated = true;
        markerColor = '#22d3ee';
      } else if (isIncomingToSelected) {
        // Incoming dependency: Amber / Orange
        stroke = '#f59e0b';
        strokeWidth = 2.5;
        animated = true;
        markerColor = '#f59e0b';
      } else if (isSimEdge) {
        stroke = '#a855f7';
        strokeWidth = 2.5;
        animated = true;
        markerColor = '#a855f7';
      } else if (selectedNodeId) {
        stroke = 'rgba(255, 255, 255, 0.04)';
        strokeWidth = 0.8;
      }

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated,
        style: { stroke, strokeWidth },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: markerColor,
          width: 14,
          height: 14,
        },
      };
    });
  }, [graphData, selectedNodeId, activeSimNodeId]);

  // Copy Path Helper
  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1800);
  };

  // Reset View
  const handleReset = useCallback(() => {
    setSelectedNodeId(null);
    setSearchTerm('');
    setSelectedCategory('all');
    setIsSimulating(false);
    fitView({ padding: 0.15, duration: 400 });
  }, [fitView]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-void p-6 font-mono">
        <LatticeLoader size="md" label="Mapping real repository dependency graph..." sublabel="Tracing imports, exports & callers" />
      </div>
    );
  }

  if (error || !graphData || graphData.nodes.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-void p-6 text-center font-mono">
        <div className="max-w-md p-6 rounded-2xl bg-surface/80 border border-white/10 shadow-2xl">
          <FileCode className="w-10 h-10 text-cyan-400 mx-auto mb-3 opacity-80" />
          <h3 className="text-sm font-bold text-white mb-1">Dependency Graph Unavailable</h3>
          <p className="text-xs text-zinc-400 mb-4 font-sans leading-relaxed">
            {error || 'No internal module dependencies detected for this repository.'}
          </p>
          <button
            onClick={fetchDependencyGraph}
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 hover:bg-cyan-500/30 text-xs transition-all"
          >
            Retry Analysis
          </button>
        </div>
      </div>
    );
  }

  const categoryCounts: Record<string, number> = {
    all: graphData.nodes.length,
    entry: graphData.nodes.filter((n) => n.type === 'entry').length,
    route: graphData.nodes.filter((n) => n.type === 'route').length,
    service: graphData.nodes.filter((n) => n.type === 'service').length,
    controller: graphData.nodes.filter((n) => n.type === 'controller').length,
    component: graphData.nodes.filter((n) => n.type === 'component').length,
    storage: graphData.nodes.filter((n) => n.type === 'storage').length,
    ai: graphData.nodes.filter((n) => n.type === 'ai').length,
    config: graphData.nodes.filter((n) => n.type === 'config').length,
    utility: graphData.nodes.filter((n) => n.type === 'utility').length,
  };

  return (
    <div className={`w-full h-full flex flex-col bg-void text-zinc-100 overflow-hidden relative ${className}`}>
      {/* 1. TOP TOOLBAR: Search, Category Filters, Simulation, and Zoom Controls */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-surface/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 z-10 select-none">
        {/* Left: Search & Category Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search files/modules..."
              className="pl-8 pr-3 py-1 bg-void border border-white/10 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400/50 w-44 sm:w-52 font-mono"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Category Filters */}
          <div className="hidden md:flex items-center gap-1 bg-void/60 p-1 rounded-lg border border-white/10 text-[11px] font-mono">
            {(['all', 'entry', 'route', 'service', 'controller', 'storage', 'component'] as const).map(
              (cat) => {
                const count = categoryCounts[cat] || 0;
                if (count === 0 && cat !== 'all') return null;

                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${isActive
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-medium'
                      : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                  >
                    <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                    <span className="text-[9px] opacity-60">({count})</span>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Right: Simulation & Canvas Controls */}
        <div className="flex items-center gap-2">
          {/* Simulate Flow Button */}
          {simSequence.length > 0 && (
            <button
              onClick={() => {
                setIsSimulating((prev) => !prev);
                if (!isSimulating) setSimStepIndex(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-all ${isSimulating
                ? 'bg-violet-500/20 text-violet-200 border-violet-400/50 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                : 'bg-surface hover:bg-white/5 text-zinc-300 border-white/10'
                }`}
            >
              {isSimulating ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                  <span>Pause Flow</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Simulate Flow</span>
                </>
              )}
            </button>
          )}

          {/* Fit View */}
          <button
            onClick={() => fitView({ padding: 0.2, duration: 400 })}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-white/5 border border-white/10 text-xs text-zinc-300 transition-colors font-mono"
            title="Fit graph to view"
          >
            <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Fit</span>
          </button>

          {/* Reset View */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-white/5 border border-white/10 text-xs text-zinc-300 transition-colors font-mono"
            title="Reset layout and filters"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN GRAPH CANVAS */}
      <div className="flex-1 min-h-0 relative">
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={customNodeTypes}
          fitView
          nodesDraggable={true}
          nodesConnectable={false}
          onNodeClick={(_, node) => {
            setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
          }}
          onNodeDoubleClick={(_, node) => {
            onNavigateToFile(node.id);
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="bg-surface/90 border border-white/10 rounded-lg text-white" />
          <MiniMap
            nodeColor={(node) => {
              const n = node.data?.node as DependencyGraphNode;
              if (n?.type === 'entry') return '#22d3ee';
              if (n?.type === 'route') return '#3b82f6';
              if (n?.type === 'service') return '#10b981';
              if (n?.type === 'controller') return '#a855f7';
              if (n?.type === 'storage') return '#f97316';
              return '#64748b';
            }}
            maskColor="rgba(7, 9, 14, 0.88)"
            className="bg-surface/90 border border-white/10 rounded-lg hidden sm:block"
          />
          <Background gap={24} color="#151d2a" />
        </ReactFlow>

        {/* 3. SIMULATION FLOW OVERLAY DOCK (Bottom Center) */}
        {isSimulating && simSequence.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto w-full max-w-lg px-4">
            <div className="p-3.5 rounded-2xl bg-surface/95 border border-violet-500/30 backdrop-blur-2xl shadow-2xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-violet-300 font-mono flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                  <span>Execution Flow Simulation</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  Step {simStepIndex + 1} of {simSequence.length}
                </span>
              </div>

              {/* Step Title & Explanation */}
              <div className="text-xs text-white font-medium">
                {simSequence[simStepIndex]?.title}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {simSequence[simStepIndex]?.description}
              </p>

              {/* Simulation Controls & Disclaimer */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSimulating((prev) => !prev)}
                    className="p-1 rounded bg-white/10 hover:bg-white/20 text-white"
                  >
                    {isSimulating ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={() => setSimStepIndex((prev) => (prev + 1) % simSequence.length)}
                    className="p-1 rounded bg-white/10 hover:bg-white/20 text-white"
                    title="Next Step"
                  >
                    <SkipForward className="w-3 h-3" />
                  </button>
                </div>

                <span className="text-zinc-500 text-[9px]">
                  Verified Static Graph · Simulated Sequence
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4. NODE INSPECTION DRAWER (Slide-over on the Right) */}
        {selectedNode && (
          <div className="absolute top-4 right-4 bottom-4 w-80 sm:w-96 rounded-2xl bg-surface/95 border border-white/15 backdrop-blur-2xl shadow-2xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border ${NODE_THEMES[selectedNode.type]?.badgeBg || 'bg-white/10'
                      }`}
                  >
                    {selectedNode.type.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {selectedNode.layer || 'Architecture'}
                  </span>
                </div>
                <h3 className="font-mono text-sm font-bold text-white truncate" title={selectedNode.path}>
                  {selectedNode.label}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Close inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono">
              {/* File Path & Copy */}
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                  File Path
                </label>
                <div className="flex items-center justify-between p-2 rounded-lg bg-void border border-white/10 text-zinc-300 text-[11px] break-all">
                  <span>{selectedNode.path}</span>
                  <button
                    onClick={() => handleCopyPath(selectedNode.path)}
                    className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                    title="Copy Path"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Module Description */}
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                  Role & Purpose
                </label>
                <p className="text-zinc-300 font-sans text-xs leading-relaxed bg-void/50 p-2.5 rounded-lg border border-white/5">
                  {selectedNode.description}
                </p>
              </div>

              {/* Incoming Dependencies (Imported by) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-amber-400 uppercase tracking-wider flex items-center gap-1 font-semibold">
                    <ArrowLeft className="w-3 h-3" />
                    <span>Incoming Dependencies ({selectedNode.importedBy?.length || 0})</span>
                  </label>
                  <span className="text-[9px] text-zinc-500">Callers</span>
                </div>
                {selectedNode.importedBy && selectedNode.importedBy.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {selectedNode.importedBy.map((caller) => (
                      <button
                        key={caller}
                        onClick={() => setSelectedNodeId(caller)}
                        className="w-full text-left p-1.5 rounded bg-void/60 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 text-[11px] text-zinc-300 truncate transition-colors flex items-center justify-between group"
                      >
                        <span className="truncate">{caller}</span>
                        <ArrowLeft className="w-2.5 h-2.5 text-amber-400 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 italic p-1.5">
                    Root entry point or zero internal callers.
                  </p>
                )}
              </div>

              {/* Outgoing Dependencies (Imports) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-emerald-400 uppercase tracking-wider flex items-center gap-1 font-semibold">
                    <span>Outgoing Dependencies ({selectedNode.resolvedImports?.length || 0})</span>
                    <ArrowRight className="w-3 h-3" />
                  </label>
                  <span className="text-[9px] text-zinc-500">Callees</span>
                </div>
                {selectedNode.resolvedImports && selectedNode.resolvedImports.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {selectedNode.resolvedImports.map((dep) => (
                      <button
                        key={dep}
                        onClick={() => setSelectedNodeId(dep)}
                        className="w-full text-left p-1.5 rounded bg-void/60 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 text-[11px] text-zinc-300 truncate transition-colors flex items-center justify-between group"
                      >
                        <span className="truncate">{dep}</span>
                        <ArrowRight className="w-2.5 h-2.5 text-emerald-400 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 italic p-1.5">
                    Leaf module with no internal repository imports.
                  </p>
                )}
              </div>

              {/* Important Exports */}
              {selectedNode.exports && selectedNode.exports.length > 0 && (
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">
                    Exported Symbols ({selectedNode.exports.length})
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.exports.map((exp) => (
                      <span
                        key={exp}
                        className="px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20 text-cyan-300 text-[10px]"
                      >
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Action Footer */}
            <div className="p-4 border-t border-white/10 bg-void/60">
              <button
                onClick={() => onNavigateToFile(selectedNode.path)}
                className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-void font-semibold font-mono text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(34,211,238,0.25)]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Code Viewer</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
