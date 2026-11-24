'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface ThoughtLineProps {
  isThinking?: boolean;
  label?: string;
  steps?: string[];
  currentStepIndex?: number;
  className?: string;
  variant?: 'cyan' | 'violet' | 'emerald';
  allowFold?: boolean;
}

/**
 * React Bits - Thought Line
 * A reasoning trace header featuring a live clock and a breathing glyph that
 * neatly folds its expansion steps down into a single consolidated line once settled.
 */
export const ThoughtLine: React.FC<ThoughtLineProps> = ({
  isThinking = true,
  label = 'Synthesizing codebase context...',
  steps = [
    'Parsing AST syntax trees & symbols',
    'Tracing module imports & dependency graph',
    'Evaluating cyclomatic complexity & risk vectors',
    'Synthesizing architectural conclusions',
  ],
  currentStepIndex = 1,
  className = '',
  variant = 'cyan',
  allowFold = true,
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Live stopwatch counter
  useEffect(() => {
    if (!isThinking) return;
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Number(((Date.now() - start) / 1000).toFixed(1)));
    }, 100);

    return () => clearInterval(timer);
  }, [isThinking]);

  const colorMap = {
    cyan: {
      line: 'from-cyan-500/20 via-cyan-400 to-cyan-500/20',
      dot: 'bg-cyan-400',
      glow: 'shadow-[0_0_12px_rgba(34,211,238,0.6)]',
      text: 'text-cyan-400',
      border: 'border-cyan-400/30',
      bg: 'bg-cyan-500/10',
    },
    violet: {
      line: 'from-violet-500/20 via-violet-400 to-violet-500/20',
      dot: 'bg-violet-400',
      glow: 'shadow-[0_0_12px_rgba(168,85,247,0.6)]',
      text: 'text-violet-400',
      border: 'border-violet-400/30',
      bg: 'bg-violet-500/10',
    },
    emerald: {
      line: 'from-emerald-500/20 via-emerald-400 to-emerald-500/20',
      dot: 'bg-emerald-400',
      glow: 'shadow-[0_0_12px_rgba(52,211,153,0.6)]',
      text: 'text-emerald-400',
      border: 'border-emerald-400/30',
      bg: 'bg-emerald-500/10',
    },
  };

  const currentTheme = colorMap[variant] || colorMap.cyan;

  if (!isThinking && !allowFold) return null;

  return (
    <div className={`flex flex-col gap-1.5 w-full select-none font-mono text-xs ${className}`}>
      {/* Consolidated Reasoning Header Row */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface/80 border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2 truncate">
          {/* Breathing Glyph */}
          <div className="relative flex items-center justify-center w-4 h-4 flex-shrink-0">
            {isThinking ? (
              <>
                <motion.div
                  className={`absolute inset-0 rounded-full ${currentTheme.dot}`}
                  animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <Sparkles className={`w-3.5 h-3.5 ${currentTheme.text}`} />
              </>
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>

          {/* Action text */}
          <span className="font-medium text-zinc-200 truncate text-[11px] tracking-wide">
            {label}
          </span>
        </div>

        {/* Live stopwatch clock & unfold toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-zinc-400 font-mono bg-void px-1.5 py-0.5 rounded border border-white/5">
            {elapsed.toFixed(1)}s
          </span>

          {steps.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1 rounded hover:bg-white/5 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={isExpanded ? 'Fold steps' : 'Expand reasoning trace'}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Pulsing high-energy thought wave line */}
      <div className="relative h-1 w-full flex items-center overflow-hidden rounded bg-slate-900 border border-slate-800/60">
        <motion.div
          className={`absolute top-0 bottom-0 w-28 bg-gradient-to-r ${currentTheme.line} ${currentTheme.glow}`}
          animate={{ x: ['-100%', '700%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Expandable step-by-step reasoning trace */}
      <AnimatePresence>
        {isExpanded && steps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="overflow-hidden px-2 pt-1 pb-1.5 space-y-1 border-l-2 border-cyan-400/30 ml-2"
          >
            {steps.map((step, idx) => {
              const isPast = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 text-[10px] ${
                    isCurrent
                      ? 'text-cyan-300 font-medium'
                      : isPast
                      ? 'text-zinc-400'
                      : 'text-zinc-600'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCurrent
                        ? `${currentTheme.dot} animate-ping`
                        : isPast
                        ? 'bg-emerald-400'
                        : 'bg-zinc-700'
                    }`}
                  />
                  <span>{step}</span>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
