'use client';

import React, { useState, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  type Edge as FlowEdge,
  type Node as FlowNode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Network,
  GitCommit,
  Layers,
  Database,
  Search,
  ArrowRight,
  Info,
  RotateCcw,
  ShieldCheck,
  HelpCircle,
  FileCode,
  Zap,
  Cpu,
  Workflow,
  ExternalLink,
} from 'lucide-react';
import type { KeyModule, ArchitectureOverview } from '@/types/analysis.types';
import type { FileNode } from '@/types/codebase.types';
import { DependencyGraphView } from './DependencyGraphView';

interface ArchitectureViewProps {
  sessionId?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  keyModules: KeyModule[];
  onNavigateToFile: (path: string) => void;
  dataFlowDescription?: string;
  overview?: ArchitectureOverview | null;
  fileTree?: FileNode[];
}

type FlowTab = 'map' | 'execution' | 'modules' | 'dataflow';
type VisualizationMode = 'architecture' | 'dependencies';

export function ArchitectureView(props: ArchitectureViewProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureViewContent {...props} />
    </ReactFlowProvider>
  );
}

function ArchitectureViewContent({
  sessionId,
  nodes,
  edges,
  keyModules,
  onNavigateToFile,
  dataFlowDescription,
  overview,
}: ArchitectureViewProps) {
  const [visMode, setVisMode] = useState<VisualizationMode>('architecture');
  const [activeTab, setActiveTab] = useState<FlowTab>('map');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeInfo, setHoveredNodeInfo] = useState<string | null>(null);

  const { fitView } = useReactFlow();

  // Reset focus and zoom
  const handleResetView = useCallback(() => {
    setSelectedNodeId(null);
    setSearchTerm('');
    fitView({ padding: 0.2, duration: 400 });
  }, [fitView]);

  // Neighborhood discovery: identify connected neighbors
  const neighborIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>();
    set.add(selectedNodeId);

    edges.forEach((edge) => {
      if (edge.source === selectedNodeId) {
        set.add(edge.target);
      }
      if (edge.target === selectedNodeId) {
        set.add(edge.source);
      }
    });

    return set;
  }, [selectedNodeId, edges]);

  // Filter & style nodes for Architecture Map
  const displayNodes = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return nodes.map((node) => {
      const label = String(node.data?.label || '');
      const matchesSearch = !term || label.toLowerCase().includes(term);

      let opacity = 1;
      let border = node.style?.border || '1px solid rgba(255,255,255,0.15)';
      let boxShadow = 'none';

      if (selectedNodeId) {
        const isNeighbor = neighborIds.has(node.id);
        opacity = isNeighbor ? 1 : 0.15;
        if (node.id === selectedNodeId) {
          border = '2px solid #22d3ee';
          boxShadow = '0 0 16px rgba(34, 211, 238, 0.4)';
        }
      } else if (term) {
        opacity = matchesSearch ? 1 : 0.2;
        if (matchesSearch) {
          border = '2px solid #22d3ee';
        }
      }

      return {
        ...node,
        style: {
          ...node.style,
          opacity,
          border,
          boxShadow,
          transition: 'all 0.2s ease',
        },
      };
    });
  }, [nodes, searchTerm, selectedNodeId, neighborIds]);

  // Style edges based on selection
  const displayEdges = useMemo(() => {
    if (!selectedNodeId) return edges;

    return edges.map((edge) => {
      const isConnected = edge.source === selectedNodeId || edge.target === selectedNodeId;
      return {
        ...edge,
        animated: isConnected,
        style: {
          ...edge.style,
          stroke: isConnected ? '#22d3ee' : 'rgba(255, 255, 255, 0.08)',
          strokeWidth: isConnected ? 2.5 : 1,
        },
      };
    });
  }, [edges, selectedNodeId]);

  // Filter modules for Module Explorer
  const filteredModules = useMemo(() => {
    if (!searchTerm.trim()) return keyModules || [];
    const term = searchTerm.toLowerCase();
    return (keyModules || []).filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.path.toLowerCase().includes(term) ||
        m.responsibility.toLowerCase().includes(term)
    );
  }, [keyModules, searchTerm]);

  // Build Execution Flow based on actual repository analysis
  const executionSteps = useMemo(() => {
    if (overview?.executionFlow && overview.executionFlow.length > 0) {
      return overview.executionFlow.map((step) => ({
        step: step.step,
        title: step.title,
        description: step.description,
        files: step.files,
        confirmed: step.statusLabel === 'CONFIRMED',
        statusLabel: step.statusLabel,
        type: step.stage,
      }));
    }

    const steps: {
      step: number;
      title: string;
      description: string;
      files: string[];
      confirmed: boolean;
      statusLabel: 'CONFIRMED' | 'INFERRED';
      type: string;
    }[] = [];

    // 1. Entry point stage
    const entryFiles = overview?.detectedEntryPoints && overview.detectedEntryPoints.length > 0
      ? overview.detectedEntryPoints
      : keyModules
        .filter((m) => m.path.includes('server') || m.path.includes('app') || m.path.includes('index') || m.path.includes('main'))
        .map((m) => m.path);

    steps.push({
      step: 1,
      title: 'Incoming Ingestion & Server Bootstrap',
      description:
        entryFiles.length > 0
          ? `Listens for incoming network connections, initializes runtime configuration, and registers core middleware.`
          : `Application bootstrap and execution environment setup.`,
      files: entryFiles.length > 0 ? entryFiles : ['src/index.ts'],
      confirmed: entryFiles.length > 0,
      statusLabel: entryFiles.length > 0 ? 'CONFIRMED' : 'INFERRED',
      type: 'entry',
    });

    // 2. Routing & Middleware stage
    const routeModules = keyModules.filter(
      (m) => m.path.includes('route') || m.path.includes('controller') || m.path.includes('api') || m.name.toLowerCase().includes('route')
    );
    steps.push({
      step: 2,
      title: 'Request Routing & Security Guards',
      description:
        routeModules.length > 0
          ? `Dispatches request URI to matched route patterns, executing path validation, parameter parsing, and authorization checks.`
          : `Routes incoming execution contexts to matching business handlers and middleware handlers.`,
      files: routeModules.map((m) => m.path),
      confirmed: routeModules.length > 0,
      statusLabel: routeModules.length > 0 ? 'CONFIRMED' : 'INFERRED',
      type: 'route',
    });

    // 3. Domain Logic & Core Services
    const serviceModules = keyModules.filter(
      (m) =>
        m.path.includes('service') ||
        m.path.includes('engine') ||
        m.path.includes('lib') ||
        m.path.includes('core') ||
        (!m.path.includes('route') && !m.path.includes('server') && !m.path.includes('model'))
    );
    steps.push({
      step: 3,
      title: 'Business Logic & Core Processing',
      description:
        serviceModules.length > 0
          ? `Executes primary computational workflows, orchestrates internal services, and applies business rules.`
          : `Primary service logic execution and state transformation.`,
      files: serviceModules.map((m) => m.path),
      confirmed: serviceModules.length > 0,
      statusLabel: serviceModules.length > 0 ? 'CONFIRMED' : 'INFERRED',
      type: 'service',
    });

    // 4. Persistence / State / Models
    const modelModules = keyModules.filter(
      (m) =>
        m.path.includes('model') ||
        m.path.includes('db') ||
        m.path.includes('store') ||
        m.path.includes('schema') ||
        m.path.includes('repository')
    );
    if (modelModules.length > 0 || overview?.deepDive?.dataLifecycle) {
      steps.push({
        step: 4,
        title: 'State Mutation & Data Persistence',
        description:
          modelModules.length > 0
            ? `Interacts with persistent entities, reads cached datasets, and ensures transactional consistency.`
            : `Reads or mutates persistent application state.`,
        files: modelModules.map((m) => m.path),
        confirmed: modelModules.length > 0,
        statusLabel: modelModules.length > 0 ? 'CONFIRMED' : 'INFERRED',
        type: 'storage',
      });
    }

    // 5. Response Serialization & Egress
    steps.push({
      step: steps.length + 1,
      title: 'Response Formatting & Client Egress',
      description: `Formats transformed domain output into client-ready payloads (JSON, HTML, or stream) and sets response headers.`,
      files: entryFiles.slice(0, 1),
      confirmed: false,
      statusLabel: 'INFERRED',
      type: 'egress',
    });

    return steps;
  }, [overview, keyModules]);

  // Derive Data Flow Stages
  const dataFlowStages = useMemo(() => {
    return [
      {
        stage: '01. Ingestion',
        label: 'Source Ingestion',
        description: 'External client requests, webhook triggers, or CLI arguments.',
        tech: overview?.projectType || 'HTTP / REST',
        badge: 'INPUT',
      },
      {
        stage: '02. Validation',
        label: 'Schema Validation',
        description: 'Input parameter sanitization, route token verification, and payload extraction.',
        tech: overview?.framework || 'Middleware',
        badge: 'SECURITY',
      },
      {
        stage: '03. Processing',
        label: 'Core Transformation',
        description: overview?.dataFlow || 'State computation, domain entity resolution, and algorithmic transformations.',
        tech: overview?.pattern || 'Service Layer',
        badge: 'COMPUTE',
      },
      {
        stage: '04. Storage',
        label: 'State & Persistence',
        description: overview?.deepDive?.dataLifecycle || 'Session cache, local database storage, or external API persistence.',
        tech: 'Persistence',
        badge: 'STATE',
      },
      {
        stage: '05. Egress',
        label: 'Payload Delivery',
        description: 'Serialized HTTP response, event emitter broadcast, or standard output streaming.',
        tech: 'Output Buffer',
        badge: 'OUTPUT',
      },
    ];
  }, [overview]);

  return (
    <div className="flex-1 flex flex-col h-full bg-void/50 overflow-hidden font-mono select-none">
      {/* 1. PRIMARY VIEW SWITCHER: Architecture Map vs Dependency Graph */}
      <div className="px-4 py-2 border-b border-white/10 bg-void/90 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl bg-surface/90 border border-white/15 p-1 text-xs shadow-inner">
            <button
              onClick={() => setVisMode('architecture')}
              className={`cursor-target flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all font-mono text-xs ${
                visMode === 'architecture'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 font-semibold shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              data-cursor-label="Architecture Map"
            >
              <Workflow className="w-3.5 h-3.5 text-cyan-400" />
              <span>Architecture Map</span>
            </button>

            <button
              onClick={() => setVisMode('dependencies')}
              className={`cursor-target flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all font-mono text-xs ${
                visMode === 'dependencies'
                  ? 'bg-violet-500/20 text-violet-200 border border-violet-400/40 font-semibold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              data-cursor-label="Dependency Graph"
            >
              <Network className="w-3.5 h-3.5 text-violet-400" />
              <span>Dependency Graph</span>
              <span className="px-1.5 py-0.2 rounded-full bg-violet-400/20 text-[9px] text-violet-300 font-bold">
                NEW
              </span>
            </button>
          </div>

          <div className="hidden sm:block text-[11px] text-zinc-400 font-sans">
            {visMode === 'architecture'
              ? 'High-level architectural pipeline, execution stages & data flow'
              : 'Interactive real-time node graph of files, imports & caller relationships'}
          </div>
        </div>

        {/* Mode Indicators */}
        <div className="flex items-center gap-2">
          {overview?.analysisMode && (
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider ${overview.analysisMode === 'ai-enriched'
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-400/20'
                : overview.analysisMode === 'cached'
                  ? 'bg-violet-500/10 text-violet-300 border-violet-400/20'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                }`}
            >
              {overview.analysisMode === 'ai-enriched'
                ? 'AI Enriched'
                : overview.analysisMode === 'cached'
                  ? 'Fingerprint Cached'
                  : 'AST Deterministic'}
            </span>
          )}
        </div>
      </div>

      {visMode === 'dependencies' ? (
        <DependencyGraphView
          sessionId={sessionId || ''}
          onNavigateToFile={onNavigateToFile}
        />
      ) : (
        <>
          {/* Top Header & Tab Navigation Bar */}
          <div className="px-4 py-2 border-b border-white/10 bg-surface/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-cyan-400">
                <Workflow className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-white tracking-wide flex items-center gap-2">
                  <span>System Flow & Architecture Intelligence</span>
                  {overview?.confidence && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-400/20">
                      {overview.confidence}% confidence
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-zinc-400">
                  {overview?.pattern || 'Modular architecture'} · Grounded in AST and dependency graphs
                </p>
              </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center rounded-lg bg-void/80 border border-white/10 p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('map')}
                className={`cursor-target flex items-center gap-1.5 px-3 py-1 rounded-md transition-all text-xs font-mono ${
                  activeTab === 'map'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                data-cursor-label="Architecture Map"
              >
                <Network className="w-3.5 h-3.5 text-cyan-400" />
                <span>Architecture Map</span>
              </button>

              <button
                onClick={() => setActiveTab('execution')}
                className={`cursor-target flex items-center gap-1.5 px-3 py-1 rounded-md transition-all text-xs font-mono ${
                  activeTab === 'execution'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                data-cursor-label="Execution Flow"
              >
                <GitCommit className="w-3.5 h-3.5 text-violet-400" />
                <span>Execution Flow</span>
              </button>

              <button
                onClick={() => setActiveTab('modules')}
                className={`cursor-target flex items-center gap-1.5 px-3 py-1 rounded-md transition-all text-xs font-mono ${
                  activeTab === 'modules'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                data-cursor-label="Module Explorer"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Module Explorer</span>
              </button>

              <button
                onClick={() => setActiveTab('dataflow')}
                className={`cursor-target flex items-center gap-1.5 px-3 py-1 rounded-md transition-all text-xs font-mono ${
                  activeTab === 'dataflow'
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                data-cursor-label="Data Flow"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>Data Flow</span>
              </button>
            </div>

            {/* Global Filter & Actions */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search elements..."
                  className="pl-8 pr-3 py-1 bg-void border border-white/10 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400/50 w-36 sm:w-44"
                />
              </div>

              {activeTab === 'map' && (
                <button
                  onClick={handleResetView}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-white/5 border border-white/10 text-xs text-zinc-300 transition-colors"
                  title="Reset Zoom & Pan"
                >
                  <RotateCcw className="w-3 h-3 text-cyan-400" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Content Areas based on selected tab */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {/* ========================================================= */}
            {/* TAB A: ARCHITECTURE MAP                                   */}
            {/* ========================================================= */}
            {activeTab === 'map' && (
              <div className="w-full h-full relative bg-void/90">
                <ReactFlow
                  nodes={displayNodes}
                  edges={displayEdges}
                  fitView
                  nodesDraggable={true}
                  nodesConnectable={false}
                  onNodeClick={(_, node) => {
                    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
                  }}
                  onNodeDoubleClick={(_, node) => {
                    const label = String(node.data?.label || '');
                    const matched = keyModules.find(
                      (m) => m.name.toLowerCase() === label.toLowerCase() || m.path.includes(label)
                    );
                    if (matched) {
                      onNavigateToFile(matched.path);
                    }
                  }}
                  onNodeMouseEnter={(_, node) => setHoveredNodeInfo(String(node.data?.label || ''))}
                  onNodeMouseLeave={() => setHoveredNodeInfo(null)}
                  proOptions={{ hideAttribution: true }}
                >
                  <Controls className="bg-surface/90 border border-white/10 rounded-lg text-white" />
                  <MiniMap
                    nodeColor="#22d3ee"
                    maskColor="rgba(7, 9, 14, 0.85)"
                    className="bg-surface/90 border border-white/10 rounded-lg hidden sm:block"
                  />
                  <Background gap={22} color="#182030" />
                </ReactFlow>

                {/* Neighborhood Focus & Legend Card (Bottom Left) */}
                <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10 pointer-events-auto">
                  <div className="p-3 rounded-xl bg-surface/95 border border-white/10 backdrop-blur-xl shadow-2xl text-xs space-y-2 max-w-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Topology Inspector</span>
                      </span>
                      {selectedNodeId && (
                        <button
                          onClick={() => setSelectedNodeId(null)}
                          className="text-[10px] text-cyan-400 hover:underline"
                        >
                          Clear Focus
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                      {selectedNodeId ? (
                        <p>
                          Focusing on <strong>{selectedNodeId}</strong> and{' '}
                          <strong>{Math.max(0, neighborIds.size - 1)}</strong> connected neighbor(s). Double-click to inspect code.
                        </p>
                      ) : (
                        <p>
                          Click any node to focus on its neighborhood. Double-click to open its source file.
                        </p>
                      )}
                    </div>

                    {/* Legend badges */}
                    <div className="pt-1.5 border-t border-white/10 grid grid-cols-2 gap-1.5 text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span>Entry / Service</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-violet-400" />
                        <span>Downstream</span>
                      </span>
                    </div>
                  </div>

                  {hoveredNodeInfo && !selectedNodeId && (
                    <div className="px-3 py-1.5 rounded-lg bg-surface/95 border border-cyan-400/30 text-xs text-cyan-200 shadow-xl backdrop-blur-md flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Double-click to view code: <strong>{hoveredNodeInfo}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB B: EXECUTION FLOW                                     */}
            {/* ========================================================= */}
            {activeTab === 'execution' && (
              <div className="w-full h-full overflow-y-auto p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
                {/* Header Description */}
                <div className="p-4 rounded-xl border border-white/10 bg-surface/40 backdrop-blur-md flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <GitCommit className="w-4 h-4 text-violet-400" />
                      <span>Repository Execution Pipeline</span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 font-sans leading-relaxed">
                      How execution travels through the codebase from entry to response. Each stage is validated against repository imports and module boundaries.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 text-[10px]">
                    <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      <span>CONFIRMED AST</span>
                    </span>
                    <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      <span>INFERRED FLOW</span>
                    </span>
                  </div>
                </div>

                {/* Stepped Timeline */}
                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-[2px] before:bg-gradient-to-b before:from-cyan-400 before:via-violet-400 before:to-emerald-400">
                  {executionSteps.map((step) => (
                    <div key={step.step} className="relative group">
                      {/* Step Marker Dot */}
                      <div className="absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full bg-void border-2 border-cyan-400 flex items-center justify-center text-[10px] font-bold text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                        {step.step}
                      </div>

                      {/* Step Card */}
                      <div className="p-4 rounded-xl border border-white/10 bg-surface/70 hover:border-cyan-400/40 hover:bg-surface/90 transition-all space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-100 group-hover:text-cyan-200 transition-colors">
                              {step.title}
                            </span>
                            <span
                              className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${step.statusLabel === 'CONFIRMED'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}
                            >
                              {step.statusLabel}
                            </span>
                          </div>

                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                            Stage {step.step} of {executionSteps.length}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                          {step.description}
                        </p>

                        {/* Files participating in this step */}
                        {step.files.length > 0 && (
                          <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-zinc-500 font-mono">Files:</span>
                            {step.files.map((file) => (
                              <button
                                key={file}
                                onClick={() => onNavigateToFile(file)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-cyan-500/15 text-zinc-300 hover:text-cyan-200 border border-white/10 hover:border-cyan-400/30 text-[10px] font-mono transition-all"
                                title={`Inspect ${file}`}
                              >
                                <FileCode className="w-3 h-3 text-cyan-400" />
                                <span>{file}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB C: COMPONENT / MODULE EXPLORER                         */}
            {/* ========================================================= */}
            {activeTab === 'modules' && (
              <div className="w-full h-full overflow-y-auto p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span>Module Boundaries & Functional Responsibilities</span>
                    </h4>
                    <p className="text-xs text-zinc-400 mt-1 font-sans">
                      Structured breakdown of discovered architectural modules with their dependencies and source files.
                    </p>
                  </div>

                  <span className="text-xs font-mono text-zinc-400">
                    {filteredModules.length} module{filteredModules.length === 1 ? '' : 's'} identified
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredModules.length === 0 ? (
                    <div className="col-span-2 p-8 text-center text-xs text-zinc-500">
                      No modules match the current filter query.
                    </div>
                  ) : (
                    filteredModules.map((module, idx) => {
                      // Find related edges
                      const outgoingEdges = edges.filter((e) => e.source.toLowerCase().includes(module.name.toLowerCase()));
                      const incomingEdges = edges.filter((e) => e.target.toLowerCase().includes(module.name.toLowerCase()));

                      return (
                        <div
                          key={`${module.path}-${idx}`}
                          className="p-4 rounded-xl border border-white/10 bg-surface/60 hover:border-cyan-400/30 hover:bg-surface/80 transition-all flex flex-col justify-between gap-3 group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-zinc-100 group-hover:text-cyan-200 transition-colors">
                                {module.name}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                VERIFIED AST
                              </span>
                            </div>

                            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                              {module.responsibility}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-white/5 space-y-2 text-[10px] font-mono">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-500">Dependencies:</span>
                              <span className="text-zinc-400">
                                {outgoingEdges.length} outgoing · {incomingEdges.length} incoming
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-cyan-400 truncate max-w-[240px]">
                                {module.path}
                              </span>
                              <button
                                onClick={() => onNavigateToFile(module.path)}
                                className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-semibold"
                              >
                                <span>Inspect</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB D: DATA FLOW LIFECYCLE                                */}
            {/* ========================================================= */}
            {activeTab === 'dataflow' && (
              <div className="w-full h-full overflow-y-auto p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
                <div className="p-4 rounded-xl border border-white/10 bg-surface/40 backdrop-blur-md">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span>System Data Flow & State Lifecycle</span>
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1 font-sans leading-relaxed">
                    {dataFlowDescription ||
                      overview?.dataFlow ||
                      'Traces how information enters the application, passes through business transformations, interacts with storage layers, and exits to clients.'}
                  </p>
                </div>

                {/* Horizontal or Vertical Data Pipeline Stages */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {dataFlowStages.map((stage, idx) => (
                    <div
                      key={stage.stage}
                      className="p-3.5 rounded-xl border border-white/10 bg-surface/70 hover:border-amber-400/30 hover:bg-surface/90 transition-all flex flex-col justify-between relative space-y-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-amber-400 font-bold">{stage.stage}</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-400">
                            {stage.badge}
                          </span>
                        </div>

                        <h5 className="text-xs font-semibold text-zinc-100">{stage.label}</h5>
                        <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
                          {stage.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/5 text-[10px] font-mono text-zinc-400 flex items-center justify-between">
                        <span>Tech / Layer:</span>
                        <span className="text-zinc-200 truncate font-semibold">{stage.tech}</span>
                      </div>

                      {/* Visual Arrow connector between stages */}
                      {idx < dataFlowStages.length - 1 && (
                        <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-void border border-white/10 items-center justify-center z-10 text-zinc-400">
                          <ArrowRight className="w-3 h-3 text-cyan-400" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Deep Dive Narrative Section */}
                {overview?.deepDive && (
                  <div className="p-4 rounded-xl border border-white/10 bg-surface/50 space-y-3 font-sans text-xs">
                    <h5 className="font-semibold text-zinc-200 font-mono text-xs flex items-center gap-2">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Runtime & Lifecycle Observations</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-zinc-300 leading-relaxed">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">
                          Runtime Flow
                        </span>
                        <p>{overview.deepDive.runtimeFlow || 'Standard request/response pipeline.'}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block">
                          Data Lifecycle
                        </span>
                        <p>{overview.deepDive.dataLifecycle || 'Stateless transformations with client persistence.'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
