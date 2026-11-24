'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderGit2,
  Upload,
  ArrowRight,
  Sparkles,
  Network,
  FileCode2,
  MessageSquareCode,
  ShieldAlert,
  GitBranch,
  Layers,
  Terminal,
  Loader2,
  Cpu,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/config';
import type { AnalyzeGitHubRequest, AnalyzeGitHubResponse } from '@/types/api.types';
import { CodeIntelligenceGraph } from '@/components/landing/CodeIntelligenceGraph';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { LatticeLoader, ShapeGrid } from '@/components/react-bits';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('error') === 'session-expired';

  const [activeTab, setActiveTab] = useState<'github' | 'zip'>('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [error, setError] = useState('');

  const analysisStages = [
    'Connecting to repository & checking fingerprint cache...',
    'Fetching repository archive & extracting files...',
    'Mapping directory structure & module boundaries...',
    'Extracting AST symbols & import call graphs...',
    'Synthesizing canonical architecture & risk profile...',
    'Preparing developer workspace...',
  ];

  const sampleRepos = [
    { name: 'express', url: 'https://github.com/expressjs/express', desc: 'Node.js web framework' },
    { name: 'flask', url: 'https://github.com/pallets/flask', desc: 'Python microframework' },
    { name: 'axios', url: 'https://github.com/axios/axios', desc: 'Promise-based HTTP client' },
    { name: 'zustand', url: 'https://github.com/pmndrs/zustand', desc: 'React state management' },
  ];

  const handleGitHubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;

    setError('');
    setIsLoading(true);
    setCurrentStageIndex(0);
    setLoadingStep(analysisStages[0]);

    try {
      const stageTimer1 = setTimeout(() => {
        setCurrentStageIndex(1);
        setLoadingStep(analysisStages[1]);
      }, 800);

      const stageTimer2 = setTimeout(() => {
        setCurrentStageIndex(2);
        setLoadingStep(analysisStages[2]);
      }, 1800);

      const stageTimer3 = setTimeout(() => {
        setCurrentStageIndex(3);
        setLoadingStep(analysisStages[3]);
      }, 3000);

      const response = await apiClient.post<AnalyzeGitHubResponse>(
        API_ENDPOINTS.ANALYZE_GITHUB,
        { githubUrl: githubUrl.trim() } as AnalyzeGitHubRequest
      );

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);

      setCurrentStageIndex(4);
      setLoadingStep(analysisStages[4]);

      setTimeout(() => {
        setCurrentStageIndex(5);
        setLoadingStep(analysisStages[5]);
        if (response.data) {
          router.push(`/analyze/${response.data.sessionId}`);
        }
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze repository');
      setIsLoading(false);
    }
  };

  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a ZIP file to analyze');
      return;
    }

    setError('');
    setIsLoading(true);
    setLoadingStep('Decompressing repository archive...');

    try {
      setTimeout(() => setLoadingStep('Parsing syntax trees and module imports...'), 1200);

      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.uploadFile<AnalyzeGitHubResponse>(
        API_ENDPOINTS.UPLOAD_ZIP,
        formData
      );

      if (response.data) {
        router.push(`/analyze/${response.data.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process ZIP file');
      setIsLoading(false);
    }
  };

  const handleSelectSample = (url: string) => {
    setGithubUrl(url);
    setActiveTab('github');
    setError('');
  };

  return (
    <div className="min-h-screen bg-void text-zinc-100 relative overflow-x-hidden selection:bg-cyan-500/30 selection:text-white">
      {/* Precision Background Atmosphere — React Bits Shape Grid */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <ShapeGrid
          shape="square"
          cellSize={46}
          lineWidth={1}
          direction="diagonal"
          speed={0.3}
          lineColor="rgba(34, 211, 238, 0.07)"
          hoverColor="#22d3ee"
          hoverFillColor="rgba(6, 182, 212, 0.12)"
          fillOpacity={0.16}
          glow={0.35}
          twinkle={0.12}
          tiltX={22}
          tiltY={-6}
          fade={0.25}
          clickCascade={true}
          intro={true}
          backgroundColor="transparent"
          className="opacity-80"
        />
        <div className="dev-radial-glow opacity-75" />
      </div>

      {/* Analysis In-Progress Lattice Modal */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-void/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none"
          >
            <LatticeLoader
              size="lg"
              label="Synthesizing Repository Intelligence"
              sublabel={loadingStep || 'Mapping AST syntax trees & architecture relationships...'}
            />

            {/* Structured Stage Sequence */}
            <div className="mt-4 w-full max-w-sm bg-surface/70 border border-white/10 rounded-xl p-3.5 font-mono text-xs space-y-2 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-white/5 pb-1.5">
                <span>STAGE {currentStageIndex + 1} OF {analysisStages.length}</span>
                <span className="text-cyan-400 font-semibold">{Math.round(((currentStageIndex + 1) / analysisStages.length) * 100)}%</span>
              </div>
              <div className="space-y-1">
                {analysisStages.map((stg, i) => {
                  const isDone = i < currentStageIndex;
                  const isCurrent = i === currentStageIndex;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-[10px] transition-colors ${
                        isCurrent ? 'text-cyan-300 font-medium' : isDone ? 'text-zinc-400' : 'text-zinc-600'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isCurrent ? 'bg-cyan-400 animate-ping' : isDone ? 'bg-emerald-400' : 'bg-zinc-700'
                        }`}
                      />
                      <span className="truncate">{stg}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navigation */}
      <header className="relative z-30 border-b border-white/5 bg-void/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-white flex items-center gap-2">
                AI Codebase Explainer
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                  v2.0
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Engine Online
            </span>
            <a
              href="#how-it-works"
              className="hover:text-zinc-200 transition-colors hidden md:inline"
            >
              How It Works
            </a>
            <a
              href="#features"
              className="hover:text-zinc-200 transition-colors hidden md:inline"
            >
              Features
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-14 pb-24">
        {/* Session Expired Banner */}
        {sessionExpired && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl max-w-2xl mx-auto flex items-center justify-between gap-3 text-xs text-amber-200"
          >
            <span>Previous session expired. Enter a repository URL to launch a new analysis.</span>
            <button
              onClick={() => router.replace('/')}
              className="font-mono underline hover:text-amber-100"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* SECTION 1: HERO */}
        <section className="mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Heading, Subheading & Repository Ingest */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/25 bg-cyan-500/5 text-xs font-mono text-cyan-300">
                <Sparkles className="w-3.5 h-3.5" />
                <span>CODE INTELLIGENCE ENGINE</span>
              </div>

              <div className="space-y-3">
                <h1 className="text-4xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.12]">
                  Your codebase isn't a{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400">
                    mystery anymore.
                  </span>
                </h1>
                <p className="text-base sm:text-lg text-zinc-300 leading-relaxed font-normal">
                  Explore repositories. Understand architecture. Trace dependencies. Discover risks — powered by AI.
                </p>
              </div>

              {/* Repository Ingest Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl shadow-2xl space-y-4">
                {/* Method Switcher Tabs */}
                <div className="flex gap-1.5 p-1 rounded-xl bg-void/60 border border-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('github')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      activeTab === 'github'
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>GitHub Repository</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('zip')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                      activeTab === 'zip'
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 shadow-[0_0_12px_rgba(34,211,238,0.15)]'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload ZIP</span>
                  </button>
                </div>

                {/* Form Body */}
                <AnimatePresence mode="wait">
                  {activeTab === 'github' ? (
                    <motion.form
                      key="github-hero-form"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      onSubmit={handleGitHubSubmit}
                      className="space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          placeholder="https://github.com/owner/repository"
                          disabled={isLoading}
                          className="flex-1 py-2.5 px-3.5 rounded-xl bg-void border border-white/10 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 font-mono focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all min-w-0"
                        />
                        <button
                          type="submit"
                          disabled={isLoading || !githubUrl.trim()}
                          className="py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-void font-semibold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(34,211,238,0.25)] flex-shrink-0"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Scanning</span>
                            </>
                          ) : (
                            <>
                              <span>Analyze</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Sample Repositories */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-mono text-zinc-400 mr-1">
                          Try sample:
                        </span>
                        {sampleRepos.map((repo) => (
                          <button
                            key={repo.name}
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSelectSample(repo.url)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-400/30 text-zinc-300 hover:text-cyan-200 transition-all"
                          >
                            {repo.name}
                          </button>
                        ))}
                      </div>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="zip-hero-form"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      onSubmit={handleZipSubmit}
                      className="space-y-3"
                    >
                      <div className="border border-dashed border-white/15 hover:border-cyan-400/50 rounded-xl p-5 text-center bg-void/50 hover:bg-cyan-500/5 transition-all">
                        <input
                          type="file"
                          id="zipFileHero"
                          accept=".zip"
                          disabled={isLoading}
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <label
                          htmlFor="zipFileHero"
                          className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                        >
                          <Upload className="w-6 h-6 text-cyan-400 mb-1" />
                          <span className="text-xs font-semibold text-zinc-200">
                            {file ? file.name : 'Select or drop repository ZIP'}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            Archives up to 50MB supported
                          </span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading || !file}
                        className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-void font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Processing Archive</span>
                          </>
                        ) : (
                          <>
                            <span>Analyze ZIP Archive</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Progress Status Bar when Loading */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-2 border-t border-white/5 space-y-1.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between text-cyan-300 text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <Cpu className="w-3 h-3 animate-spin text-cyan-400" />
                        {loadingStep || 'Analyzing codebase...'}
                      </span>
                      <span className="text-zinc-500">Live</span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full animate-pulse w-3/4" />
                    </div>
                  </motion.div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Interactive Code Intelligence Graph */}
            <div className="lg:col-span-6">
              <CodeIntelligenceGraph />
            </div>
          </div>
        </section>

        {/* SECTION 2: INTERACTIVE PRODUCT PREVIEW */}
        <section className="mb-24">
          <ProductPreview />
        </section>

        {/* SECTION 3: FEATURE MATRIX */}
        <section id="features" className="mb-24 space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono font-medium text-cyan-300 uppercase tracking-wider">
              Core Capabilities
            </span>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Built for architectural clarity
            </h2>
            <p className="text-sm text-zinc-400 max-w-lg mx-auto">
              Everything you need to onboard onto complex unfamiliar codebases without drowning in noise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Feature 1 */}
            <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 hover:border-cyan-400/30 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400">
                <Network className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Understand Architecture</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Automatically extracts architectural boundaries, entry points, and end-to-end data flows across modules.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 hover:border-cyan-400/30 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400">
                <FileCode2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Explain Any File</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Click any file to inspect function declarations, parameter signatures, exports, and design pattern observations.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 hover:border-cyan-400/30 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Trace Dependencies</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Follow import graphs and downstream consumers visually. Know exactly what breaks before refactoring.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 hover:border-cyan-400/30 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center text-violet-400">
                <MessageSquareCode className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Ask Questions About Your Code</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Dockable codebase chat aware of the active file, selected snippet, and architectural context.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 hover:border-cyan-400/30 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-400/20 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Discover Risks & Hot Spots</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Surface cyclomatic complexity hot spots, potential bugs, security oversights, and concrete mitigation actions.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-5 rounded-2xl border border-white/10 bg-surface/60 hover:border-cyan-400/30 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400">
                <GitBranch className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Instant GitHub & ZIP Ingest</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect any public repository URL or upload a local archive directly. No complicated agent setup required.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: HOW IT WORKS */}
        <section id="how-it-works" className="mb-24 space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono font-medium text-cyan-300 uppercase tracking-wider">
              Workflow
            </span>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl border border-white/10 bg-surface/50 space-y-3 relative">
              <div className="text-xs font-mono text-cyan-400 font-bold">01 / INGEST</div>
              <h4 className="text-base font-semibold text-white">Connect Source</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Paste any GitHub repository URL or drag & drop a ZIP archive. The engine recursively builds the complete file hierarchy.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl border border-white/10 bg-surface/50 space-y-3 relative">
              <div className="text-xs font-mono text-cyan-400 font-bold">02 / MAP & GRAPH</div>
              <h4 className="text-base font-semibold text-white">Synthesize Graph</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Static token parsing extracts imports, function definitions, and module boundaries to construct an interactive topological map.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl border border-white/10 bg-surface/50 space-y-3 relative">
              <div className="text-xs font-mono text-cyan-400 font-bold">03 / INSPECT & QUERY</div>
              <h4 className="text-base font-semibold text-white">Gain Instant Mastery</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Inspect files with AI syntax breakdowns, explore quality scorecards, isolate risks, and chat with your repository.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: FINAL REPO IMPORT CTA */}
        <section className="p-8 md:p-12 rounded-3xl border border-cyan-400/20 bg-gradient-to-b from-surface/90 to-elevated/70 backdrop-blur-xl text-center space-y-6 max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.1),transparent_70%)] pointer-events-none" />

          <div className="relative z-10 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Ready to understand your next codebase?
            </h2>
            <p className="text-sm text-zinc-300 max-w-md mx-auto">
              Drop in a repository URL below and explore its architecture in seconds.
            </p>
          </div>

          <div className="relative z-10 max-w-xl mx-auto">
            <form onSubmit={handleGitHubSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                disabled={isLoading}
                className="flex-1 py-2.5 px-3.5 rounded-xl bg-void border border-white/15 text-xs font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400/50"
              />
              <button
                type="submit"
                disabled={isLoading || !githubUrl.trim()}
                className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-void font-semibold text-xs transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
              >
                <span>Analyze</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Minimal Developer Footer */}
      <footer className="border-t border-white/5 bg-void/80 py-8 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400 font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span>AI Codebase Explainer</span>
            <span>·</span>
            <span className="text-zinc-400">Cinematic Developer Intelligence</span>
          </div>
          <div className="text-zinc-400">
            Powered by modern AST parsing & AI reasoning
          </div>
        </div>
      </footer>
    </div>
  );
}
