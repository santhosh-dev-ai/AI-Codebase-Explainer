'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/config';
import { formatBytes, getFileIcon, prettyPrintLanguage } from '@/lib/utils';
import type { FileNode, RepoMetadata } from '@/types/codebase.types';
import type { ArchitectureOverview } from '@/types/analysis.types';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  ArrowLeft,
  Files,
  Code2,
  HardDrive,
  Layers,
  Search,
  X,
  Copy,
  Check,
  Loader2,
  RefreshCcw,
  Sparkles,
  BarChart3,
} from 'lucide-react';

interface AnalyzePageProps {
  params: { sessionId: string };
}

interface FileTreeData {
  fileTree: FileNode[];
  metadata: RepoMetadata;
}

interface FileContentData {
  path: string;
  content: string;
  language: string;
  lines: number;
  size: number;
}

export default function AnalyzePage({ params }: AnalyzePageProps) {
  const router = useRouter();
  const { sessionId } = params;
  const mainLayoutRef = useRef<HTMLDivElement | null>(null);

  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [metadata, setMetadata] = useState<RepoMetadata | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<ArchitectureOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  // File viewer state
  const [selectedFile, setSelectedFile] = useState<FileContentData | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Folder expansion state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Pane resize state
  const [leftPaneWidth, setLeftPaneWidth] = useState(288);
  const [rightPaneWidth, setRightPaneWidth] = useState(360);
  const [draggingPane, setDraggingPane] = useState<'left' | 'right' | null>(null);

  // Load file tree on mount
  useEffect(() => {
    const fetchFileTree = async () => {
      try {
        setIsLoadingTree(true);
        const response = await apiClient.get<FileTreeData>(
          API_ENDPOINTS.GET_FILE_TREE(sessionId)
        );
        if (response.data) {
          setFileTree(response.data.fileTree);
          setMetadata(response.data.metadata);
          // Auto-expand root folders
          const rootFolders = response.data.fileTree
            .filter((n: FileNode) => n.type === 'directory')
            .map((n: FileNode) => n.path);
          setExpandedFolders(new Set(rootFolders));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file tree');
      } finally {
        setIsLoadingTree(false);
      }
    };

    fetchFileTree();
  }, [sessionId]);

  // File click handler
  const handleFileClick = useCallback(async (filePath: string) => {
    try {
      setIsLoadingFile(true);
      const response = await apiClient.get<FileContentData>(
        API_ENDPOINTS.GET_FILE(sessionId),
        { filePath }
      );
      if (response.data) {
        setSelectedFile(response.data);
      }
    } catch (err) {
      console.error('Failed to load file:', err);
    } finally {
      setIsLoadingFile(false);
    }
  }, [sessionId]);

  // Toggle folder
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      setIsLoadingOverview(true);
      setOverviewError('');

      const response = await apiClient.get<{ overview: ArchitectureOverview }>(
        API_ENDPOINTS.GET_OVERVIEW(sessionId)
      );

      if (response.data?.overview) {
        setOverview(response.data.overview);
      }
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : 'Failed to load repository overview');
    } finally {
      setIsLoadingOverview(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingPane || !mainLayoutRef.current) {
        return;
      }

      const rect = mainLayoutRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const minLeft = 220;
      const maxLeft = 520;
      const minRight = 280;
      const maxRight = 620;
      const minCenter = 420;

      if (draggingPane === 'left') {
        const maxAllowedLeft = Math.min(maxLeft, rect.width - rightPaneWidth - minCenter);
        const next = Math.max(minLeft, Math.min(x, maxAllowedLeft));
        setLeftPaneWidth(next);
      }

      if (draggingPane === 'right') {
        const rawRight = rect.width - x;
        const maxAllowedRight = Math.min(maxRight, rect.width - leftPaneWidth - minCenter);
        const next = Math.max(minRight, Math.min(rawRight, maxAllowedRight));
        setRightPaneWidth(next);
      }
    };

    const onMouseUp = () => {
      setDraggingPane(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggingPane, leftPaneWidth, rightPaneWidth]);

  // Copy file content
  const copyContent = useCallback(() => {
    if (selectedFile?.content) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedFile]);

  // Filter files by search
  const filterTree = useCallback((nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();

    return nodes.reduce<FileNode[]>((acc, node) => {
      if (node.type === 'file') {
        if (node.name.toLowerCase().includes(lowerQuery) || node.path.toLowerCase().includes(lowerQuery)) {
          acc.push(node);
        }
      } else if (node.children) {
        const filteredChildren = filterTree(node.children, query);
        if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lowerQuery)) {
          acc.push({ ...node, children: filteredChildren });
        }
      }
      return acc;
    }, []);
  }, []);

  const displayedTree = searchQuery ? filterTree(fileTree, searchQuery) : fileTree;

  const riskBreakdown = (overview?.risks || []).reduce(
    (acc, risk) => {
      acc[risk.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  const reportScores = overview?.scorecard
    ? [
        { key: 'Architecture', value: overview.scorecard.architecture, color: '#60a5fa' },
        { key: 'Maintainability', value: overview.scorecard.maintainability, color: '#22c55e' },
        { key: 'Complexity', value: overview.scorecard.complexity, color: '#f59e0b' },
        { key: 'Reliability', value: overview.scorecard.reliability, color: '#a78bfa' },
        { key: 'Security', value: overview.scorecard.security, color: '#ef4444' },
      ]
    : [];

  const languageChart = metadata
    ? Object.entries(metadata.languages)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([lang, count]) => ({
          label: prettyPrintLanguage(lang),
          value: Math.round((count / Math.max(1, metadata.totalFiles)) * 100),
          color: getLanguageColor(lang),
        }))
    : [];

  const specialityParts = [overview?.projectType, overview?.framework, overview?.pattern].filter(
    Boolean
  ) as string[];
  const dominantLanguage = metadata
    ? Object.entries(metadata.languages).sort(([, a], [, b]) => b - a)[0]?.[0]
    : null;
  const repoSpeciality =
    specialityParts.length > 0
      ? specialityParts.join(' • ')
      : dominantLanguage
        ? `${prettyPrintLanguage(dominantLanguage)} codebase`
        : 'AI analysis in progress';

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-error" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-3">Session Error</h1>
          <p className="text-text-secondary mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-accent hover:bg-accent/80 text-white rounded-lg font-medium transition-colors"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="h-screen flex flex-col bg-background premium-bg overflow-hidden relative"
    >
      <div className="premium-grid" />
      {/* Top Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-white/10 glass-panel-strong flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="w-px h-6 bg-border" />
          <h1 className="text-sm font-semibold text-text-primary">
            Repository Overview
          </h1>
          {metadata && (
            <span className="text-xs text-text-secondary bg-background px-2 py-0.5 rounded-full">
              Total files: {metadata.totalFiles}
            </span>
          )}
          <span className="hidden lg:inline-flex max-w-[420px] truncate text-xs text-zinc-300 bg-zinc-900/70 border border-white/10 px-2 py-0.5 rounded-full">
            Speciality: {repoSpeciality}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
            title="Search files"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Search bar */}
      <AnimatePresence>
        {searchOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="px-4 py-2 border-b border-white/10 bg-zinc-900/40 backdrop-blur-xl"
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-10 pr-10 py-2 bg-background border border-border rounded-md text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Main Content */}
      <div ref={mainLayoutRef} className="flex flex-1 overflow-hidden p-3 gap-3 relative z-10">
        {/* Sidebar - File Tree */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="glass-panel rounded-2xl overflow-hidden flex flex-col flex-shrink-0"
          style={{ width: `${leftPaneWidth}px` }}
        >
          <div className="p-3 border-b border-white/10">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Explorer
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2 scroll-smooth momentum-scroll">
            {isLoadingTree ? (
              <div className="space-y-2 p-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-border animate-skeleton" />
                    <div className="h-3 rounded bg-border animate-skeleton" style={{ width: `${60 + Math.random() * 80}px` }} />
                  </div>
                ))}
              </div>
            ) : (
              <FileTreeView
                nodes={displayedTree}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                onFileClick={handleFileClick}
                selectedPath={selectedFile?.path || null}
                level={0}
              />
            )}
          </div>
        </motion.aside>

        <div
          className={`hidden lg:block w-1 bg-border/70 hover:bg-accent/70 transition-colors cursor-col-resize ${draggingPane === 'left' ? 'bg-accent' : ''}`}
          onMouseDown={() => setDraggingPane('left')}
          title="Drag to resize explorer"
        />

        {/* Center - File Viewer */}
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex-1 flex flex-col overflow-hidden glass-panel rounded-2xl"
        >
          {isLoadingFile ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-text-secondary text-sm">Loading file...</p>
              </div>
            </div>
          ) : selectedFile ? (
            <>
              {/* File header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center min-w-10 px-2 h-6 rounded-md border border-white/15 bg-white/5 text-[10px] tracking-wide font-semibold text-zinc-300">
                    {getFileIcon(selectedFile.path)}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{selectedFile.path}</span>
                  <span className="text-xs text-text-secondary bg-background px-2 py-0.5 rounded-full">
                    {selectedFile.language}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary">
                    {selectedFile.lines} lines · {formatBytes(selectedFile.size)}
                  </span>
                  <button
                    onClick={copyContent}
                    className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover rounded transition-colors"
                    title="Copy file content"
                  >
                    {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* File content */}
              <motion.div
                key={selectedFile.path}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.22 }}
                className="flex-1 overflow-auto scroll-smooth momentum-scroll"
              >
                <pre className="p-5 text-sm leading-relaxed shadow-inner shadow-black/20">
                  <code>
                    {selectedFile.content.split('\n').map((line, i) => (
                      <div key={i} className="flex hover:bg-hover/50 transition-colors">
                        <span className="inline-block w-12 text-right pr-4 text-text-secondary/50 select-none flex-shrink-0 font-mono text-xs leading-relaxed">
                          {i + 1}
                        </span>
                        <span className="text-text-primary font-mono whitespace-pre">{line || ' '}</span>
                      </div>
                    ))}
                  </code>
                </pre>
              </motion.div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mx-auto mb-6">
                  <Code2 className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary mb-2">
                  Select a file to view
                </h2>
                <p className="text-sm text-text-secondary">
                  Click on any file in the explorer to view its contents
                </p>
              </div>
            </div>
          )}
        </motion.main>

        <div
          className={`hidden lg:block w-1 bg-border/70 hover:bg-accent/70 transition-colors cursor-col-resize ${draggingPane === 'right' ? 'bg-accent' : ''}`}
          onMouseDown={() => setDraggingPane('right')}
          title="Drag to resize details panel"
        />

        {/* Right Panel - Metadata */}
        {metadata && (
          <motion.aside
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="glass-panel rounded-2xl flex flex-col flex-shrink-0 overflow-y-auto scroll-smooth momentum-scroll"
            style={{ width: `${rightPaneWidth}px` }}
          >
            <div className="p-4 border-b border-white/10">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                AI Overview
              </h2>

              {isLoadingOverview ? (
                <div className="space-y-3">
                  <div className="h-4 w-24 rounded bg-border animate-skeleton" />
                  <div className="h-3 w-full rounded bg-border animate-skeleton" />
                  <div className="h-3 w-5/6 rounded bg-border animate-skeleton" />
                  <div className="h-3 w-4/5 rounded bg-border animate-skeleton" />
                </div>
              ) : overviewError ? (
                <div className="premium-card rounded-xl p-3 border-error/40 bg-error/10">
                  <p className="text-xs text-error mb-3">{overviewError}</p>
                  <button
                    onClick={fetchOverview}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 hover:border-accent text-text-primary transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              ) : overview ? (
                <div className="space-y-4">
                  <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="premium-card rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-accent" />
                      <span className="text-xs font-semibold text-text-primary">Summary</span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{overview.summary}</p>
                  </motion.div>

                  {overview.executiveBullets && overview.executiveBullets.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Executive Summary</p>
                      <div className="space-y-1.5">
                        {overview.executiveBullets.slice(0, 10).map((point, index) => (
                          <p key={`${point}-${index}`} className="text-xs text-text-secondary leading-relaxed">- {point}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded border border-border bg-background/60 p-2">
                      <p className="text-text-secondary">Pattern</p>
                      <p className="text-text-primary font-medium mt-1">{overview.pattern}</p>
                    </div>
                    <div className="rounded border border-border bg-background/60 p-2">
                      <p className="text-text-secondary">Confidence</p>
                      <p className="text-text-primary font-medium mt-1">{overview.confidence ?? 0}%</p>
                    </div>
                    <div className="rounded border border-border bg-background/60 p-2 col-span-2">
                      <p className="text-text-secondary">Type / Framework</p>
                      <p className="text-text-primary font-medium mt-1">
                        {overview.projectType}
                        {overview.framework ? ` / ${overview.framework}` : ''}
                      </p>
                    </div>
                  </div>

                  {reportScores.length > 0 && (
                    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="premium-card rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-accent" />
                        <span className="text-xs font-semibold text-text-primary">Report Dashboard</span>
                      </div>

                      <div className="space-y-2.5 mb-4">
                        {reportScores.map((item) => (
                          <ScoreBar key={item.key} label={item.key} value={item.value} color={item.color} />
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] mb-4">
                        <div className="rounded border border-border p-2 bg-background/70">
                          <p className="text-text-secondary">High Risks</p>
                          <p className="text-error font-semibold mt-1">{riskBreakdown.high}</p>
                        </div>
                        <div className="rounded border border-border p-2 bg-background/70">
                          <p className="text-text-secondary">Medium</p>
                          <p className="text-yellow-400 font-semibold mt-1">{riskBreakdown.medium}</p>
                        </div>
                        <div className="rounded border border-border p-2 bg-background/70">
                          <p className="text-text-secondary">Low</p>
                          <p className="text-green-400 font-semibold mt-1">{riskBreakdown.low}</p>
                        </div>
                      </div>

                      {languageChart.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Top Languages (Share)</p>
                          <div className="space-y-2">
                            {languageChart.map((item) => (
                              <ScoreBar key={item.label} label={item.label} value={item.value} color={item.color} suffix="%" />
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {overview.deepDive && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Detailed Explanation</p>
                      <DeepDiveCard title="Architecture Narrative" content={overview.deepDive.architectureNarrative} />
                      <DeepDiveCard title="Runtime Flow" content={overview.deepDive.runtimeFlow} />
                      <DeepDiveCard title="Data Lifecycle" content={overview.deepDive.dataLifecycle} />
                      <DeepDiveCard title="Quality Signals" content={overview.deepDive.qualitySignals} />
                      <DeepDiveCard title="Scalability and Ops" content={overview.deepDive.scalabilityAndOps} />
                      <DeepDiveCard title="Recommendations" content={overview.deepDive.recommendations} />
                    </div>
                  )}

                  {overview.techStack.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Tech Stack</p>
                      <div className="flex flex-wrap gap-1.5">
                        {overview.techStack.slice(0, 16).map((item) => (
                          <span
                            key={item}
                            className="text-[11px] px-2 py-1 rounded border border-border bg-background text-text-primary"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {overview.detectedEntryPoints && overview.detectedEntryPoints.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Entry Points</p>
                      <div className="space-y-1.5">
                        {overview.detectedEntryPoints.slice(0, 8).map((entry) => (
                          <p key={entry} className="text-xs text-text-primary break-all">{entry}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {overview.keyModules.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Key Modules</p>
                      <div className="space-y-2">
                        {overview.keyModules.slice(0, 8).map((module) => (
                          <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18 }} key={`${module.path}-${module.name}`} className="premium-card rounded-xl p-2">
                            <p className="text-xs font-medium text-text-primary">{module.name}</p>
                            <p className="text-[11px] text-accent mt-0.5 break-all">{module.path}</p>
                            <p className="text-xs text-text-secondary mt-1">{module.responsibility}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Data Flow</p>
                    <ol className="space-y-1.5 list-decimal list-inside">
                      {overview.dataFlow
                        .split(/\n|->|=>/)
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .slice(0, 8)
                        .map((step, index) => (
                          <li key={`${step}-${index}`} className="text-xs text-text-secondary leading-relaxed">
                            {step}
                          </li>
                        ))}
                    </ol>
                  </div>

                  {overview.risks && overview.risks.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Risks</p>
                      <div className="space-y-2">
                        {overview.risks.slice(0, 6).map((risk, index) => (
                          <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18 }} key={`${risk.title}-${index}`} className="premium-card rounded-xl p-2">
                            <p className="text-xs font-medium text-text-primary">
                              {risk.title} <span className="uppercase text-[10px] text-text-secondary">({risk.severity})</span>
                            </p>
                            <p className="text-xs text-text-secondary mt-1">{risk.detail}</p>
                            <p className="text-[11px] text-accent mt-1">Mitigation: {risk.mitigation}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {overview.evidence && overview.evidence.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Evidence</p>
                      <div className="space-y-2">
                        {overview.evidence.slice(0, 6).map((evidence, index) => (
                          <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18 }} key={`${evidence.filePath}-${index}`} className="premium-card rounded-xl p-2">
                            <p className="text-[11px] text-accent break-all">{evidence.filePath}</p>
                            <p className="text-xs text-text-primary mt-1">{evidence.finding}</p>
                            <p className="text-xs text-text-secondary mt-1">{evidence.relevance}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {overview.unknowns && overview.unknowns.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Unknowns</p>
                      <div className="space-y-1.5">
                        {overview.unknowns.slice(0, 6).map((unknown, index) => (
                          <p key={`${unknown}-${index}`} className="text-xs text-text-secondary">- {unknown}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="p-4 border-b border-white/10">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-4">
                Repository Info
              </h2>

              <div className="space-y-3">
                <MetadataStat icon={<Files className="w-4 h-4" />} label="Files" value={metadata.totalFiles.toString()} />
                <MetadataStat icon={<HardDrive className="w-4 h-4" />} label="Total Size" value={formatBytes(metadata.totalSize)} />
                <MetadataStat icon={<Layers className="w-4 h-4" />} label="Depth" value={metadata.depth.toString()} />
              </div>
            </div>

            {/* Languages */}
            <div className="p-4 border-b border-white/10">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Languages
              </h3>
              <div className="space-y-2">
                {Object.entries(metadata.languages)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([lang, count]) => {
                    const percentage = Math.round((count / metadata.totalFiles) * 100);
                    return (
                      <div key={lang} className="group">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-text-primary font-medium">{prettyPrintLanguage(lang)}</span>
                          <span className="text-text-secondary">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: getLanguageColor(lang),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* File Types */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                File Types
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(metadata.fileTypes)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 15)
                  .map(([ext, count]) => (
                    <span
                      key={ext}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-background border border-border rounded text-xs text-text-secondary hover:text-text-primary hover:border-accent/50 transition-colors cursor-default"
                    >
                      {ext} <span className="text-accent font-medium">{count}</span>
                    </span>
                  ))}
              </div>
            </div>
          </motion.aside>
        )}
      </div>
    </motion.div>
  );
}

function ScoreBar({
  label,
  value,
  color,
  suffix = '',
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary font-medium">{clamped}{suffix}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-background overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function DeepDiveCard({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded border border-border bg-background/60 p-2.5">
      <p className="text-xs font-medium text-text-primary mb-1">{title}</p>
      <p className="text-xs text-text-secondary leading-relaxed">{content}</p>
    </div>
  );
}


// ---- Sub-components ----

function FileTreeView({
  nodes,
  expandedFolders,
  onToggleFolder,
  onFileClick,
  selectedPath,
  level,
}: {
  nodes: FileNode[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileClick: (path: string) => void;
  selectedPath: string | null;
  level: number;
}) {
  return (
    <div>
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onFileClick={onFileClick}
          selectedPath={selectedPath}
          level={level}
        />
      ))}
    </div>
  );
}

function FileTreeNode({
  node,
  expandedFolders,
  onToggleFolder,
  onFileClick,
  selectedPath,
  level,
}: {
  node: FileNode;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileClick: (path: string) => void;
  selectedPath: string | null;
  level: number;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedPath === node.path;
  const isDirectory = node.type === 'directory';

  return (
    <div>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          if (isDirectory) {
            onToggleFolder(node.path);
          } else {
            onFileClick(node.path);
          }
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-lg border-l-2 text-sm transition-all duration-200 group ${
          isSelected
            ? 'bg-accent/15 text-accent border-accent shadow-[0_0_0_1px_rgba(88,166,255,0.25)]'
            : 'text-zinc-400 border-transparent hover:text-zinc-100 hover:bg-white/5 hover:border-accent/70'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {isDirectory ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-text-secondary" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-text-secondary" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 flex-shrink-0 text-accent" />
            ) : (
              <Folder className="w-4 h-4 flex-shrink-0 text-accent/70" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 flex-shrink-0" />
            <FileText className="w-4 h-4 flex-shrink-0 text-text-secondary/70" />
          </>
        )}
        <span className="truncate text-xs">{node.name}</span>
      </motion.button>

      <AnimatePresence initial={false}>
        {isDirectory && isExpanded && node.children && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <FileTreeView
              nodes={node.children}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onFileClick={onFileClick}
              selectedPath={selectedPath}
              level={level + 1}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetadataStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-text-secondary">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    typescript: '#3178c6',
    javascript: '#f1e05a',
    python: '#3572A5',
    java: '#b07219',
    html: '#e34c26',
    css: '#563d7c',
    json: '#292929',
    markdown: '#083fa1',
    go: '#00ADD8',
    rust: '#dea584',
    ruby: '#701516',
    php: '#4F5D95',
    csharp: '#178600',
    cpp: '#f34b7d',
    c: '#555555',
    shell: '#89e051',
    sql: '#e38c00',
    plaintext: '#4a5568',
    vue: '#41b883',
    svelte: '#ff3e00',
    scss: '#c6538c',
    yaml: '#cb171e',
  };
  return colors[language] || '#58a6ff';
}
