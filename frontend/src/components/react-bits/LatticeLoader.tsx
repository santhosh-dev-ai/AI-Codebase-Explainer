'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LatticeLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  className?: string;
  variant?: 'cyan' | 'violet' | 'emerald';
}

/**
 * React Bits - Lattice Loader
 * An agent status row featuring a grid/lattice of cells that brighten in a
 * phase-offset wave alongside a live stopwatch or task indicator.
 */
export const LatticeLoader: React.FC<LatticeLoaderProps> = ({
  size = 'md',
  label = 'Analyzing Codebase Topology...',
  sublabel = 'Tracing module boundaries & call graphs',
  className = '',
  variant = 'cyan',
}) => {
  const [seconds, setSeconds] = useState(0);

  // Live stopwatch counter
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setSeconds(Number(((Date.now() - start) / 1000).toFixed(1)));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const gridSize = size === 'sm' ? 4 : size === 'lg' ? 6 : 5;
  const cellSize = size === 'sm' ? 12 : size === 'lg' ? 20 : 16;

  const colorConfig = {
    cyan: {
      active: 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
      dim: 'bg-cyan-950/60 border border-cyan-500/20',
      text: 'text-cyan-400',
    },
    violet: {
      active: 'bg-violet-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]',
      dim: 'bg-violet-950/60 border border-violet-500/20',
      text: 'text-violet-400',
    },
    emerald: {
      active: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
      dim: 'bg-emerald-950/60 border border-emerald-500/20',
      text: 'text-emerald-400',
    },
  };

  const theme = colorConfig[variant] || colorConfig.cyan;

  // Grid coordinates
  const cells: { r: number; c: number; index: number }[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      cells.push({ r, c, index: r * gridSize + c });
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-4 select-none font-mono ${className}`}>
      {/* 3D Isometric Lattice Matrix */}
      <div
        className="relative p-3.5 rounded-2xl bg-surface/80 border border-white/10 backdrop-blur-md shadow-2xl"
        style={{
          transform: 'perspective(500px) rotateX(24deg) rotateZ(-12deg)',
        }}
      >
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${gridSize}, ${cellSize}px)`,
          }}
        >
          {cells.map(({ r, c, index }) => {
            // Wave propagation delay based on diagonal distance
            const delay = (r + c) * 0.12;

            return (
              <motion.div
                key={index}
                className={`rounded-[3px] transition-colors ${theme.dim}`}
                style={{ width: cellSize, height: cellSize }}
                animate={{
                  opacity: [0.15, 1, 0.15],
                  scale: [0.85, 1.1, 0.85],
                  backgroundColor: [
                    'rgba(6, 182, 212, 0.1)',
                    'rgba(34, 211, 238, 0.95)',
                    'rgba(6, 182, 212, 0.1)',
                  ],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay,
                  ease: 'easeInOut',
                }}
              />
            );
          })}
        </div>

        {/* Ambient radial center glow */}
        <div className="absolute inset-0 bg-cyan-500/10 blur-xl pointer-events-none rounded-full" />
      </div>

      {/* Agent Status Row with Live Stopwatch */}
      <div className="flex flex-col items-center text-center gap-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <p className="text-xs font-semibold text-zinc-100 tracking-wide font-mono">
            {label}
          </p>
          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-zinc-400 font-mono">
            {seconds.toFixed(1)}s
          </span>
        </div>

        {sublabel && (
          <p className="text-[11px] text-zinc-400 font-sans max-w-xs leading-relaxed">
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
};
