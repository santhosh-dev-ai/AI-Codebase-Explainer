'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCode2,
  Network,
  ShieldAlert,
  Sparkles,
  Terminal,
  CheckCircle2,
  FolderGit2,
} from 'lucide-react';

export function ProductPreview() {
  const [activeTab, setActiveTab] = useState<'architecture' | 'code' | 'risks'>('architecture');

  return (
    <div className="w-full max-w-5xl mx-auto my-16 select-none">
      {/* Section Header */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium text-cyan-300 border border-cyan-500/20 bg-cyan-500/5 mb-3">
          <Terminal className="w-3.5 h-3.5" />
          INTERACTIVE WORKSPACE PREVIEW
        </span>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
          Designed for developers who move fast
        </h2>
        <p className="text-sm text-zinc-400 max-w-lg mx-auto">
          Explore how AI Codebase Explainer connects file trees, code syntax, architectural models, and risk registers into one unified workflow.
        </p>
      </div>

      {/* Interactive Mock Window */}
      <div className="rounded-2xl border border-white/10 bg-void/90 shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Top Window Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-surface/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-zinc-300">
              <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>expressjs/express</span>
              <span className="text-zinc-600">/</span>
              <span className="text-cyan-200">lib/router/index.js</span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'architecture'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Architecture</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'code'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Code Inspector</span>
            </button>
            <button
              onClick={() => setActiveTab('risks')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'risks'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Risk Radar</span>
            </button>
          </div>
        </div>

        {/* Viewport Content */}
        <div className="min-h-[380px] p-4 md:p-6 bg-void/50">
          <AnimatePresence mode="wait">
            {activeTab === 'architecture' && (
              <motion.div
                key="arch-preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                {/* Module 1 */}
                <div className="p-4 rounded-xl border border-cyan-400/20 bg-surface/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-cyan-300">HTTP Dispatcher</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-400/20">Entry</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Processes incoming TCP/HTTP requests, initializes headers, and hands control over to middleware stack.
                  </p>
                  <div className="text-[11px] font-mono text-zinc-400 border-t border-white/5 pt-2 flex items-center justify-between">
                    <span>lib/request.js</span>
                    <span className="text-cyan-400">$\rightarrow$ Router</span>
                  </div>
                </div>

                {/* Module 2 */}
                <div className="p-4 rounded-xl border border-violet-400/20 bg-surface/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-violet-300">Router Pipeline</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-400/20">Core Logic</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Recursive layer matching mechanism that iterates over parameterized paths and executes next() callbacks.
                  </p>
                  <div className="text-[11px] font-mono text-zinc-400 border-t border-white/5 pt-2 flex items-center justify-between">
                    <span>lib/router/index.js</span>
                    <span className="text-violet-400">$\rightarrow$ Handlers</span>
                  </div>
                </div>

                {/* Module 3 */}
                <div className="p-4 rounded-xl border border-emerald-400/20 bg-surface/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-emerald-300">Response Serializer</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-400/20">Egress</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Buffers JSON, streams, and headers into RFC-compliant responses with automatic content negotiation.
                  </p>
                  <div className="text-[11px] font-mono text-zinc-400 border-t border-white/5 pt-2 flex items-center justify-between">
                    <span>lib/response.js</span>
                    <span className="text-emerald-400">Done</span>
                  </div>
                </div>

                {/* Data Flow Diagram Card */}
                <div className="md:col-span-3 p-4 rounded-xl border border-white/10 bg-elevated/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400">
                      <Network className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">Full Dependency Topology Mapped</h4>
                      <p className="text-[11px] text-zinc-400">28 internal modules · 4 external packages · 0 cyclic imports</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
                    <span>100% Analysis Confidence</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'code' && (
              <motion.div
                key="code-preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-5 gap-4"
              >
                {/* Code Window */}
                <div className="md:col-span-3 rounded-xl border border-white/10 bg-zinc-950 p-4 font-mono text-xs leading-relaxed overflow-x-auto">
                  <div className="text-zinc-500 mb-2">{'// lib/router/index.js (Sample slice)'}</div>
                  <div className="space-y-1">
                    <div className="text-zinc-400"><span className="text-zinc-600 mr-3">12</span>proto.handle = function handle(req, res, out) {'{'}</div>
                    <div className="text-zinc-400"><span className="text-zinc-600 mr-3">13</span>  var self = this;</div>
                    <div className="bg-cyan-500/20 -mx-4 px-4 py-0.5 border-l-2 border-cyan-400 text-cyan-100 flex items-center justify-between">
                      <span><span className="text-zinc-500 mr-3">14</span>  var stack = self.stack;</span>
                      <span className="text-[10px] text-cyan-300 font-mono">SELECTED</span>
                    </div>
                    <div className="text-zinc-400"><span className="text-zinc-600 mr-3">15</span>  var idx = 0;</div>
                    <div className="text-zinc-400"><span className="text-zinc-600 mr-3">16</span>  function next(err) {'{'}</div>
                    <div className="text-zinc-400"><span className="text-zinc-600 mr-3">17</span>    var layer = stack[idx++];</div>
                    <div className="text-zinc-400"><span className="text-zinc-600 mr-3">18</span>    layer.handle_request(req, res, next);</div>
                    <div className="text-zinc-400"><span className="text-zinc-600 mr-3">19</span>  {'}'}</div>
                    <div className="text-zinc-400"><span className="text-zinc-600 mr-3">20</span>{'}'};</div>
                  </div>
                </div>

                {/* AI Contextual Inspector Card */}
                <div className="md:col-span-2 rounded-xl border border-cyan-400/30 bg-surface/90 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>Contextual AI Explanation</span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">
                    This block defines Express's signature iterative middleware queue. It maintains a stateful index pointer over <code className="text-cyan-300 bg-white/5 px-1 py-0.5 rounded">stack</code>, handing execution from layer to layer via CPS (Continuation-Passing Style).
                  </p>
                  <div className="rounded-lg bg-white/5 border border-white/5 p-2.5 text-[11px] space-y-1">
                    <span className="text-zinc-400 font-mono font-medium block">Key Insight:</span>
                    <span className="text-zinc-300 leading-snug block">Error handlers are recognized by arity (functions taking 4 arguments: err, req, res, next).</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'risks' && (
              <motion.div
                key="risks-preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase font-bold text-rose-300 px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30">
                        High Complexity
                      </span>
                      <h4 className="text-xs font-semibold text-white">Deep Nested Middleware Recursion</h4>
                    </div>
                    <p className="text-xs text-zinc-300">
                      Unbounded middleware nesting without tail-call guarantees risks stack exhaustion under high asynchronous load.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 flex-shrink-0">lib/router/index.js</span>
                </div>

                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                        Maintainability
                      </span>
                      <h4 className="text-xs font-semibold text-white">Legacy Prototype Pattern Without Class Invariants</h4>
                    </div>
                    <p className="text-xs text-zinc-300">
                      Functions directly mutate object prototypes, reducing strict type traceability in modern TypeScript toolchains.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 flex-shrink-0">lib/application.js</span>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase font-bold text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                        Security Passed
                      </span>
                      <h4 className="text-xs font-semibold text-white">Query Parameter Sanitization Validated</h4>
                    </div>
                    <p className="text-xs text-zinc-300">
                      Prototypes protect against standard prototype pollution attacks during query parsing.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-zinc-400 flex-shrink-0">lib/middleware/init.js</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
