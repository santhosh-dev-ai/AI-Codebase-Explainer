'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RotateCcw, Crosshair, Sparkles } from 'lucide-react';

interface Node {
  id: string;
  name: string;
  type: 'entry' | 'route' | 'service' | 'ai' | 'model' | 'util';
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  lines: number;
  imports: number;
  risk: 'low' | 'med' | 'high';
  symbol: string;
}

interface Edge {
  source: string;
  target: string;
  animated?: boolean;
  speed?: string;
}

export function CodeIntelligenceGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [isLiveAnalyzing, setIsLiveAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [analysisLog, setAnalysisLog] = useState<string>('System idle. Ready for repository parsing.');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const initialNodes: Node[] = useMemo(
    () => [
      { id: 'server', name: 'src/server.ts', type: 'entry', x: 260, y: 65, baseX: 260, baseY: 65, lines: 142, imports: 8, risk: 'low', symbol: 'bootstrap()' },
      { id: 'auth', name: 'routes/auth.ts', type: 'route', x: 110, y: 150, baseX: 110, baseY: 150, lines: 95, imports: 5, risk: 'low', symbol: 'authRouter' },
      { id: 'analyze', name: 'routes/analyze.ts', type: 'route', x: 410, y: 140, baseX: 410, baseY: 140, lines: 210, imports: 12, risk: 'med', symbol: 'analyzeRepo()' },
      { id: 'aiService', name: 'services/ai.service.ts', type: 'ai', x: 460, y: 265, baseX: 460, baseY: 265, lines: 340, imports: 14, risk: 'low', symbol: 'GeminiEngine' },
      { id: 'repoParser', name: 'services/parser.ts', type: 'service', x: 275, y: 220, baseX: 275, baseY: 220, lines: 480, imports: 9, risk: 'high', symbol: 'BabelParser' },
      { id: 'guard', name: 'middleware/guard.ts', type: 'util', x: 75, y: 280, baseX: 75, baseY: 280, lines: 64, imports: 3, risk: 'low', symbol: 'verifyToken()' },
      { id: 'session', name: 'models/session.ts', type: 'model', x: 200, y: 345, baseX: 200, baseY: 345, lines: 110, imports: 4, risk: 'low', symbol: 'SessionStore' },
      { id: 'treeUtil', name: 'utils/fileTree.ts', type: 'util', x: 370, y: 350, baseX: 370, baseY: 350, lines: 185, imports: 6, risk: 'low', symbol: 'walkDir()' },
    ],
    []
  );

  const [nodes, setNodes] = useState<Node[]>(initialNodes);

  const edges: Edge[] = useMemo(
    () => [
      { source: 'server', target: 'auth', animated: true, speed: '2.5s' },
      { source: 'server', target: 'analyze', animated: true, speed: '2.2s' },
      { source: 'auth', target: 'guard', animated: false },
      { source: 'analyze', target: 'repoParser', animated: true, speed: '1.8s' },
      { source: 'analyze', target: 'aiService', animated: true, speed: '2s' },
      { source: 'repoParser', target: 'treeUtil', animated: false },
      { source: 'repoParser', target: 'session', animated: true, speed: '2.6s' },
      { source: 'aiService', target: 'session', animated: true, speed: '2.4s' },
    ],
    []
  );

  const codeFragments = [
    { text: 'const ast = babel.parse(code, { sourceType: "module" });', x: '6%', y: '16%', delay: 0 },
    { text: 'await Promise.all(routes.map(dispatchHandler));', x: '68%', y: '22%', delay: 1.5 },
    { text: 'type DependencyEdge = { from: string; to: string; weight: number };', x: '5%', y: '78%', delay: 3 },
    { text: 'scorecard: { maintainability: 96, security: 92, testCoverage: 89 }', x: '62%', y: '84%', delay: 2 },
  ];

  // Mouse repulsion/attraction physics
  useEffect(() => {
    if (!mousePos) return;

    setNodes((prev) =>
      prev.map((n) => {
        const dx = mousePos.x - n.baseX;
        const dy = mousePos.y - n.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 140;

        if (dist < maxDist && dist > 0) {
          const factor = (1 - dist / maxDist) * 12;
          return {
            ...n,
            x: n.baseX + (dx / dist) * factor,
            y: n.baseY + (dy / dist) * factor,
          };
        }
        return {
          ...n,
          x: n.baseX + (n.x - n.baseX) * 0.88,
          y: n.baseY + (n.y - n.baseY) * 0.88,
        };
      })
    );
  }, [mousePos]);

  // Live Analysis Simulation sequence
  useEffect(() => {
    if (!isLiveAnalyzing) return;

    const stages = [
      { step: 1, log: 'Phase 1: Ingesting entry point [src/server.ts]...' },
      { step: 2, log: 'Phase 2: Resolving route handlers & endpoints...' },
      { step: 3, log: 'Phase 3: Parsing AST symbols with BabelEngine...' },
      { step: 4, log: 'Phase 4: Synthesizing architecture vectors via Gemini...' },
      { step: 5, log: 'Phase 5: Topology verified. 8 modules, 0 cyclic imports.' },
    ];

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      if (current < stages.length) {
        setAnalysisStep(stages[current].step);
        setAnalysisLog(stages[current].log);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsLiveAnalyzing(false);
          setAnalysisStep(0);
          setAnalysisLog('Analysis complete. Topology cache warm.');
        }, 1200);
      }
    }, 1100);

    return () => clearInterval(interval);
  }, [isLiveAnalyzing]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 550;
    const y = ((e.clientY - rect.top) / rect.height) * 420;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    setNodes(initialNodes);
  };

  const getNodeColor = (type: Node['type']) => {
    switch (type) {
      case 'entry':
        return { bg: 'rgba(6, 182, 212, 0.16)', border: '#06b6d4', text: '#22d3ee', glow: 'rgba(6,182,212,0.4)' };
      case 'ai':
        return { bg: 'rgba(139, 92, 246, 0.18)', border: '#8b5cf6', text: '#c084fc', glow: 'rgba(139,92,246,0.4)' };
      case 'route':
        return { bg: 'rgba(2, 132, 199, 0.16)', border: '#0284c7', text: '#38bdf8', glow: 'rgba(2,132,199,0.35)' };
      case 'service':
        return { bg: 'rgba(16, 185, 129, 0.16)', border: '#10b981', text: '#34d399', glow: 'rgba(16,185,129,0.35)' };
      case 'model':
        return { bg: 'rgba(245, 158, 11, 0.16)', border: '#f59e0b', text: '#fbbf24', glow: 'rgba(245,158,11,0.35)' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.14)', border: '#64748b', text: '#94a3b8', glow: 'rgba(100,116,139,0.3)' };
    }
  };

  const isNodeActiveInScan = (node: Node) => {
    if (!isLiveAnalyzing) return false;
    if (analysisStep === 1 && node.type === 'entry') return true;
    if (analysisStep === 2 && node.type === 'route') return true;
    if (analysisStep === 3 && node.type === 'service') return true;
    if (analysisStep === 4 && (node.type === 'ai' || node.type === 'model')) return true;
    return false;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-[410px] md:h-[460px] rounded-2xl border border-white/10 bg-void/80 backdrop-blur-md overflow-hidden select-none shadow-2xl group"
    >
      {/* Background Reticle and Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(34,211,238,0.07)_1px,transparent_1px)] bg-[size:22px_22px] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-void/50 pointer-events-none" />

      {/* Code-aware mouse crosshair indicator (respects reduced motion & touch) */}
      {mousePos && (
        <div
          className="hidden md:block absolute pointer-events-none z-10 transition-opacity duration-150"
          style={{
            left: `${(mousePos.x / 550) * 100}%`,
            top: `${(mousePos.y / 420) * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="relative w-12 h-12 flex items-center justify-center">
            {/* Outer reticle ring */}
            <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-spin-slow" />
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />

            {/* Coordinates and token pill */}
            <div className="absolute left-8 top-0 whitespace-nowrap px-2 py-0.5 rounded bg-surface/90 border border-white/10 text-[9px] font-mono text-zinc-400 shadow-lg">
              <span className="text-cyan-400">POS</span> [{Math.round(mousePos.x)}, {Math.round(mousePos.y)}]
            </div>
          </div>
        </div>
      )}

      {/* Code fragment floating micro-elements */}
      {codeFragments.map((fragment, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.18, 0.5, 0.18] }}
          transition={{ duration: 7, repeat: Infinity, delay: fragment.delay }}
          className="absolute hidden sm:block text-[11px] font-mono text-zinc-500 pointer-events-none"
          style={{ left: fragment.x, top: fragment.y }}
        >
          <span className="text-cyan-500/40">{'// '}</span>
          {fragment.text}
        </motion.div>
      ))}

      {/* Scanning laser beam indicator */}
      <motion.div
        animate={{
          y: [-20, 460],
          opacity: [0, 0.75, 0.75, 0],
        }}
        transition={{
          duration: isLiveAnalyzing ? 2.5 : 6,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_16px_rgba(34,211,238,0.8)] pointer-events-none z-10"
      />

      {/* Top Bar: Controls & Status */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between z-20 pointer-events-auto">
        {/* Simulation Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsLiveAnalyzing(true);
              setAnalysisStep(1);
              setAnalysisLog('Initiating AST inspection sequence...');
            }}
            disabled={isLiveAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface/90 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-[11px] font-mono text-zinc-200 transition-all shadow-md disabled:opacity-50"
          >
            {isLiveAnalyzing ? (
              <>
                <RotateCcw className="w-3 h-3 text-cyan-400 animate-spin" />
                <span className="text-cyan-300">Scanning AST...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-cyan-400" />
                <span>Simulate Analysis</span>
              </>
            )}
          </button>

          {/* Quick Node Type Legend */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface/80 border border-white/10 text-[10px] font-mono text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>Entry</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Route</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Service</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span>AI/LLM</span>
            </span>
          </div>
        </div>

        {/* Live Engine Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface/90 border border-white/10 text-[10px] text-zinc-400 font-mono shadow-md">
          <span className={`w-2 h-2 rounded-full ${isLiveAnalyzing ? 'bg-amber-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
          <span className="text-zinc-200 font-medium">LIVE GRAPH</span>
        </div>
      </div>

      {/* SVG Canvas for Connections and Nodes */}
      <svg viewBox="0 0 550 420" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.4" />
          </linearGradient>

          <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges with progressive drawing & moving light particles */}
        {edges.map((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const isConnectedToHovered =
            hoveredNode && (hoveredNode.id === edge.source || hoveredNode.id === edge.target);

          const isConnectedToSelected =
            selectedNode && (selectedNode.id === edge.source || selectedNode.id === edge.target);

          const isEdgeHighlighted = isConnectedToHovered || isConnectedToSelected;

          return (
            <g key={`${edge.source}-${edge.target}`}>
              <motion.line
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={isEdgeHighlighted ? '#22d3ee' : 'rgba(255, 255, 255, 0.12)'}
                strokeWidth={isEdgeHighlighted ? 2.2 : 1.2}
                strokeDasharray={edge.animated ? '4,4' : undefined}
                className={edge.animated ? 'animate-pulse' : ''}
              />

              {/* Traveling light particle on active edges */}
              {edge.animated && (
                <circle r={2.8} fill="#22d3ee" filter="url(#nodeGlow)">
                  <animateMotion
                    path={`M ${sourceNode.x} ${sourceNode.y} L ${targetNode.x} ${targetNode.y}`}
                    dur={edge.speed || '2.5s'}
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const colors = getNodeColor(node.type);
          const isHovered = hoveredNode?.id === node.id;
          const isSelected = selectedNode?.id === node.id;
          const isScanning = isNodeActiveInScan(node);

          const isFaded =
            (hoveredNode &&
              hoveredNode.id !== node.id &&
              !edges.some(
                (e) =>
                  (e.source === hoveredNode.id && e.target === node.id) ||
                  (e.target === hoveredNode.id && e.source === node.id)
              )) ||
            (selectedNode &&
              selectedNode.id !== node.id &&
              !edges.some(
                (e) =>
                  (e.source === selectedNode.id && e.target === node.id) ||
                  (e.target === selectedNode.id && e.source === node.id)
              ));

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setSelectedNode(isSelected ? null : node)}
              className="cursor-pointer transition-opacity duration-200"
              style={{ opacity: isFaded ? 0.3 : 1 }}
            >
              {/* Scanning ripple pulse */}
              {(isScanning || isHovered || isSelected || node.type === 'ai') && (
                <circle
                  r={isHovered || isSelected ? 26 : 22}
                  fill="none"
                  stroke={colors.border}
                  strokeWidth="1.5"
                  opacity={isScanning ? 0.8 : 0.4}
                  className="animate-ping"
                />
              )}

              {/* Node Outer Circle with Glow */}
              <circle
                r={isHovered || isSelected ? 20 : 16}
                fill={colors.bg}
                stroke={isScanning ? '#ffffff' : colors.border}
                strokeWidth={isHovered || isSelected || isScanning ? 2.5 : 1.5}
                filter="url(#nodeGlow)"
                className="transition-all duration-200"
              />

              {/* Center dot / symbol icon */}
              <circle r={isHovered || isSelected ? 5.5 : 4} fill={colors.border} />

              {/* Node Filename Label */}
              <text
                y={isHovered || isSelected ? 32 : 26}
                textAnchor="middle"
                fill={isHovered || isSelected ? '#ffffff' : '#94a3b8'}
                fontSize="10"
                fontFamily="var(--font-jetbrains-mono)"
                fontWeight={isHovered || isSelected ? '600' : '500'}
                className="pointer-events-none drop-shadow-md"
              >
                {node.name.split('/').pop()}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Info Pill on Hover or Selection */}
      <AnimatePresence>
        {(hoveredNode || selectedNode) && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-12 left-4 right-4 sm:right-auto sm:max-w-sm p-3 rounded-xl border border-cyan-400/30 bg-surface/95 backdrop-blur-xl shadow-2xl text-xs z-30 font-mono"
          >
            {(() => {
              const active = hoveredNode || selectedNode!;
              return (
                <>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-cyan-300 font-semibold truncate flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                      {active.name}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        active.risk === 'high'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : active.risk === 'med'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {active.risk} risk
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-1">
                    <span>{active.lines} LOC</span>
                    <span>·</span>
                    <span>{active.imports} imports</span>
                    <span>·</span>
                    <span className="capitalize text-zinc-300">{active.type}</span>
                    <span>·</span>
                    <span className="text-cyan-400 truncate">{active.symbol}</span>
                  </div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Analysis Status Bar at Bottom */}
      <div className="absolute bottom-2 inset-x-3 flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface/80 border border-white/10 backdrop-blur-md text-[10px] font-mono text-zinc-400 z-20">
        <div className="flex items-center gap-2 truncate">
          <Sparkles className="w-3 h-3 text-cyan-400 flex-shrink-0" />
          <span className="truncate text-zinc-300">{analysisLog}</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-500 flex-shrink-0">
          <span>Click node to inspect</span>
          {selectedNode && (
            <button
              onClick={() => setSelectedNode(null)}
              className="text-cyan-400 hover:text-cyan-300 underline"
            >
              clear focus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
