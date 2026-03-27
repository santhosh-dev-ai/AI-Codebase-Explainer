'use client';

import { useState, useEffect, useCallback, useRef, useMemo, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  type Edge as FlowEdge,
  type Node as FlowNode,
} from 'reactflow';
import 'reactflow/dist/style.css';
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
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/config';
import { formatBytes, getFileIcon, prettyPrintLanguage } from '@/lib/utils';
import type { FileNode, RepoMetadata } from '@/types/codebase.types';
import type {
  ArchitectureOverview,
  AnalysisRisk,
  EvidenceItem,
  FileExplanation,
} from '@/types/analysis.types';
import type { ChatMessage as AppChatMessage } from '@/types/chat.types';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  ArrowLeft,
  Search,
  X,
  Copy,
  Check,
  Loader2,
  RefreshCcw,
  Sparkles,
  Info,
  MessageSquare,
  Send,
  AlertTriangle,
  LineChart,
  BrainCircuit,
  Layers,
  PieChart as PieChartIcon,
  BarChart3,
  Code2,
  FileSearch,
  Wand2,
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

type RightPanelTab = 'overview' | 'architecture' | 'insights' | 'risks' | 'dashboard';

type LocalChatMessage = Pick<AppChatMessage, 'id' | 'role' | 'content' | 'timestamp'>;

interface SelectionExplainState {
  x: number;
  y: number;
  snippet: string;
  lineStart: number;
  lineEnd: number;
}

export default function AnalyzePage({ params }: AnalyzePageProps) {
  const router = useRouter();
  const { sessionId } = params;
  const mainLayoutRef = useRef<HTMLDivElement | null>(null);
  const centerPanelRef = useRef<HTMLElement | null>(null);
  const codeContainerRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [metadata, setMetadata] = useState<RepoMetadata | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [error, setError] = useState('');

  const [overview, setOverview] = useState<ArchitectureOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  const [selectedFile, setSelectedFile] = useState<FileContentData | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const [fileInsight, setFileInsight] = useState<FileExplanation | null>(null);
  const [isLoadingFileInsight, setIsLoadingFileInsight] = useState(false);
  const [fileInsightError, setFileInsightError] = useState('');

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const [copied, setCopied] = useState(false);

  const [leftPaneWidth, setLeftPaneWidth] = useState(288);
  const [rightPaneWidth, setRightPaneWidth] = useState(390);
  const [draggingPane, setDraggingPane] = useState<'left' | 'right' | null>(null);
  const [chatPanelHeight, setChatPanelHeight] = useState(175);
  const [isDraggingChatSlider, setIsDraggingChatSlider] = useState(false);

  const [activeTab, setActiveTab] = useState<RightPanelTab>('overview');
  const [highlightedPaths, setHighlightedPaths] = useState<Set<string>>(new Set());
  const [highlightReason, setHighlightReason] = useState('');

  const [selectionExplain, setSelectionExplain] = useState<SelectionExplainState | null>(null);
  const [isExplainingSelection, setIsExplainingSelection] = useState(false);
  const [selectionExplanation, setSelectionExplanation] = useState('');

  const [chatMessages, setChatMessages] = useState<LocalChatMessage[]>([]);
  const [isLoadingChatHistory, setIsLoadingChatHistory] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [promptSeed] = useState(() => Date.now());

  const fetchFileTree = useCallback(async () => {
    try {
      setIsLoadingTree(true);
      const response = await apiClient.get<FileTreeData>(API_ENDPOINTS.GET_FILE_TREE(sessionId));
      if (response.data) {
        setFileTree(response.data.fileTree);
        setMetadata(response.data.metadata);

        const rootFolders = response.data.fileTree
          .filter((n) => n.type === 'directory')
          .map((n) => n.path);
        setExpandedFolders(new Set(rootFolders));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file tree');
    } finally {
      setIsLoadingTree(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  const handleFileClick = useCallback(
    async (filePath: string) => {
      try {
        setIsLoadingFile(true);
        setSelectionExplain(null);
        setSelectionExplanation('');

        const response = await apiClient.get<FileContentData>(API_ENDPOINTS.GET_FILE(sessionId), {
          filePath,
        });

        if (response.data) {
          setSelectedFile(response.data);
        }
      } catch (err) {
        console.error('Failed to load file:', err);
      } finally {
        setIsLoadingFile(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    const fetchFileInsight = async () => {
      if (!selectedFile?.path) {
        setFileInsight(null);
        setFileInsightError('');
        return;
      }

      try {
        setIsLoadingFileInsight(true);
        setFileInsightError('');

        const response = await apiClient.post<{ fileExplanation?: FileExplanation; explanation?: FileExplanation }>(
          API_ENDPOINTS.FILE_EXPLANATION(sessionId),
          { filePath: selectedFile.path }
        );

        const explanation = response.data?.fileExplanation || response.data?.explanation || null;
        setFileInsight(explanation);
      } catch (err) {
        setFileInsight(null);
        setFileInsightError(err instanceof Error ? err.message : 'File insight is unavailable');
      } finally {
        setIsLoadingFileInsight(false);
      }
    };

    fetchFileInsight();
  }, [selectedFile?.path, sessionId]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
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

  const fetchChatHistory = useCallback(async () => {
    try {
      setIsLoadingChatHistory(true);
      const response = await apiClient.get<{
        history?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>;
        messages?: Array<{ role: 'user' | 'assistant'; content: string; timestamp?: string }>;
      }>(API_ENDPOINTS.CHAT_HISTORY(sessionId));

      const raw = response.data?.history || response.data?.messages || [];
      const mapped: LocalChatMessage[] = raw.map((msg, idx) => ({
        id: `history-${idx}`,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      }));
      setChatMessages(mapped);
    } catch {
      setChatMessages([]);
    } finally {
      setIsLoadingChatHistory(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isLoadingChatHistory]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingPane && !isDraggingChatSlider) {
        return;
      }

      if (draggingPane && mainLayoutRef.current) {
        const rect = mainLayoutRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const minLeft = 220;
        const maxLeft = 520;
        const minRight = 320;
        const maxRight = 640;
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
      }

      if (isDraggingChatSlider && centerPanelRef.current) {
        const rect = centerPanelRef.current.getBoundingClientRect();
        const desiredHeight = rect.bottom - event.clientY;
        const clamped = Math.max(145, Math.min(280, Math.round(desiredHeight)));
        setChatPanelHeight(clamped);
      }
    };

    const onMouseUp = () => {
      setDraggingPane(null);
      setIsDraggingChatSlider(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [draggingPane, isDraggingChatSlider, leftPaneWidth, rightPaneWidth]);

  const copyContent = useCallback(() => {
    if (selectedFile?.content) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedFile]);

  const filterTree = useCallback((nodes: FileNode[], query: string): FileNode[] => {
    if (!query) {
      return nodes;
    }

    const lowerQuery = query.toLowerCase();

    return nodes.reduce<FileNode[]>((acc, node) => {
      if (node.type === 'file') {
        if (
          node.name.toLowerCase().includes(lowerQuery) ||
          node.path.toLowerCase().includes(lowerQuery)
        ) {
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

  const flattenedFiles = useMemo(() => flattenFileNodes(fileTree), [fileTree]);

  const totalFolders = useMemo(() => countDirectories(fileTree), [fileTree]);

  const estimatedLoc = useMemo(() => {
    if (!metadata) {
      return 0;
    }
    return Math.round(metadata.totalSize / 42);
  }, [metadata]);

  const dominantLanguage = useMemo(() => {
    if (!metadata) {
      return 'Unknown';
    }

    const dominant = Object.entries(metadata.languages).sort(([, a], [, b]) => b - a)[0]?.[0];
    return dominant ? prettyPrintLanguage(dominant) : 'Unknown';
  }, [metadata]);

  const reportScores = useMemo(() => {
    if (!overview?.scorecard) {
      return [];
    }

    return [
      {
        key: 'Architecture',
        tooltip: 'How well modules are organized and connected.',
        value: overview.scorecard.architecture,
        colorFrom: '#3a86ff',
        colorTo: '#67e8f9',
      },
      {
        key: 'Maintainability',
        tooltip: 'How easy the project is to evolve safely over time.',
        value: overview.scorecard.maintainability,
        colorFrom: '#1abc9c',
        colorTo: '#22c55e',
      },
      {
        key: 'Complexity',
        tooltip: 'How cognitively heavy the implementation appears.',
        value: overview.scorecard.complexity,
        colorFrom: '#f59e0b',
        colorTo: '#fb7185',
      },
      {
        key: 'Security',
        tooltip: 'Estimated exposure to insecure patterns and gaps.',
        value: overview.scorecard.security,
        colorFrom: '#ef4444',
        colorTo: '#f97316',
      },
    ];
  }, [overview?.scorecard]);

  const languageChart = useMemo(() => {
    if (!metadata) {
      return [];
    }

    return Object.entries(metadata.languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([lang, count]) => ({
        name: prettyPrintLanguage(lang),
        value: count,
        color: getLanguageColor(lang),
      }));
  }, [metadata]);

  const filesPerFolderData = useMemo(() => {
    const folderCount: Record<string, number> = {};

    flattenedFiles.forEach((file) => {
      const folder = file.path.includes('/') ? file.path.split('/')[0] : 'root';
      folderCount[folder] = (folderCount[folder] || 0) + 1;
    });

    return Object.entries(folderCount)
      .map(([folder, count]) => ({ folder, files: count }))
      .sort((a, b) => b.files - a.files)
      .slice(0, 10);
  }, [flattenedFiles]);

  const complexityData = useMemo(() => {
    return inferComplexityByFile(overview, flattenedFiles).slice(0, 10);
  }, [overview, flattenedFiles]);

  const folderTreemapData = useMemo(() => {
    return filesPerFolderData.map((item) => ({ name: item.folder, size: item.files }));
  }, [filesPerFolderData]);

  const riskBreakdown = useMemo(() => {
    return (overview?.risks || []).reduce(
      (acc, risk) => {
        acc[risk.severity] += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 }
    );
  }, [overview?.risks]);

  const dataFlowSteps = useMemo(() => {
    return (overview?.dataFlow || '')
      .split(/\n|->|=>/)
      .map((step) => step.trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [overview?.dataFlow]);

  const architectureGraph = useMemo(() => {
    return buildArchitectureGraph(dataFlowSteps);
  }, [dataFlowSteps]);

  const highComplexityFiles = useMemo(() => {
    return complexityData.filter((item) => item.complexity >= 65).map((item) => item.path).slice(0, 8);
  }, [complexityData]);

  const dynamicQuickPrompts = useMemo(() => {
    return buildDynamicQuickPrompts({
      sessionId,
      seed: promptSeed,
      metadata,
      overview,
      selectedFilePath: selectedFile?.path,
      highComplexityFiles,
    });
  }, [sessionId, promptSeed, metadata, overview, selectedFile?.path, highComplexityFiles]);

  const handleHighlightFiles = useCallback((paths: string[], reason: string) => {
    setHighlightedPaths(new Set(paths));
    setHighlightReason(reason);
    if (paths.length > 0) {
      setSearchQuery(paths[0].split('/').pop() || '');
    }
  }, []);

  const clearHighlights = useCallback(() => {
    setHighlightedPaths(new Set());
    setHighlightReason('');
    setSearchQuery('');
  }, []);

  const inferRiskFilesForAction = useCallback(
    (risk: AnalysisRisk): string[] => inferRiskFiles(risk, overview?.evidence || [], flattenedFiles),
    [overview?.evidence, flattenedFiles]
  );

  const sendChatMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim()) {
        return;
      }

      const userMessage: LocalChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: messageText.trim(),
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, userMessage]);
      setIsSendingChat(true);
      setChatError('');

      try {
        const response = await apiClient.post<{
          response?: string;
          answer?: string;
          message?: string;
        }>(API_ENDPOINTS.CHAT_MESSAGE(sessionId), {
          message: messageText,
          context: {
            currentFile: selectedFile?.path,
            relatedFiles: Array.from(highlightedPaths).slice(0, 8),
          },
        });

        const assistantText =
          response.data?.response ||
          response.data?.answer ||
          response.data?.message ||
          'No response returned.';

        const assistantMessage: LocalChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: assistantText,
          timestamp: new Date(),
        };

        setChatMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const rawMsg = err instanceof Error ? err.message : 'Failed to send message';
        const msg = /session not found/i.test(rawMsg)
          ? 'Session expired. Re-analyze the repository to restore full codebase chat context.'
          : rawMsg;
        setChatError(msg);
      } finally {
        setIsSendingChat(false);
      }
    },
    [sessionId, selectedFile?.path, highlightedPaths]
  );

  const submitChat = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const payload = chatInput;
      setChatInput('');
      await sendChatMessage(payload);
    },
    [chatInput, sendChatMessage]
  );

  const openQuickPrompt = useCallback(
    (prompt: string) => {
      setChatInput(prompt);
    },
    [setChatInput]
  );

  const getLineFromNode = useCallback((node: globalThis.Node | null): number => {
    if (!node) {
      return 0;
    }

    const element = node instanceof Element ? node : node instanceof Text ? node.parentElement : null;
    if (!element) {
      return 0;
    }

    const lineContainer = element.closest('[data-line]') as HTMLElement | null;
    if (!lineContainer) {
      return 0;
    }

    return Number(lineContainer.dataset.line || 0);
  }, []);

  const handleCodeSelection = useCallback(() => {
    if (!selectedFile || !codeContainerRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setSelectionExplain(null);
      return;
    }

    const snippet = selection.toString().trim();
    if (snippet.length < 5) {
      setSelectionExplain(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const lineStart = getLineFromNode(selection.anchorNode);
    const lineEnd = getLineFromNode(selection.focusNode);
    const start = Math.max(1, Math.min(lineStart || lineEnd || 1, lineEnd || lineStart || 1));
    const end = Math.max(start, lineStart || lineEnd || start);

    setSelectionExplain({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      snippet,
      lineStart: start,
      lineEnd: end,
    });
  }, [selectedFile, getLineFromNode]);

  const explainSelectedCode = useCallback(async () => {
    if (!selectionExplain || !selectedFile) {
      return;
    }

    setIsExplainingSelection(true);
    setSelectionExplanation('');

    try {
      const message = [
        `Explain this selected code from ${selectedFile.path}.`,
        `Line range: ${selectionExplain.lineStart}-${selectionExplain.lineEnd}`,
        'Code snippet:',
        selectionExplain.snippet,
      ].join('\n');

      const response = await apiClient.post<{ response?: string; answer?: string; message?: string }>(
        API_ENDPOINTS.CHAT_MESSAGE(sessionId),
        {
          message,
          context: {
            currentFile: selectedFile.path,
            selectedCode: selectionExplain.snippet,
            lineRange: { start: selectionExplain.lineStart, end: selectionExplain.lineEnd },
          },
        }
      );

      setSelectionExplanation(
        response.data?.response || response.data?.answer || response.data?.message || 'No explanation returned.'
      );

      setChatMessages((prev) => [
        ...prev,
        {
          id: `u-sel-${Date.now()}`,
          role: 'user',
          content: `Explain selected code in ${selectedFile.path} (${selectionExplain.lineStart}-${selectionExplain.lineEnd})`,
          timestamp: new Date(),
        },
        {
          id: `a-sel-${Date.now()}`,
          role: 'assistant',
          content:
            response.data?.response || response.data?.answer || response.data?.message || 'No explanation returned.',
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setSelectionExplanation(err instanceof Error ? err.message : 'Failed to explain selection');
    } finally {
      setIsExplainingSelection(false);
      setSelectionExplain(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [selectionExplain, selectedFile, sessionId]);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-400" />
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

      <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-white/10 glass-panel-strong flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="w-px h-6 bg-border" />

          <h1 className="text-sm font-semibold text-text-primary">Repository Overview</h1>

          {metadata && (
            <span className="text-xs text-text-secondary bg-background px-2 py-0.5 rounded-full">
              {metadata.totalFiles} files
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {highlightReason && (
            <button
              onClick={clearHighlights}
              className="text-xs px-2 py-1 rounded-md border border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20 transition-colors"
              title={highlightReason}
            >
              Clear highlight
            </button>
          )}
          <button
            onClick={() => setSearchOpen((prev) => !prev)}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-all duration-200"
            title="Search files"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

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
                onChange={(event) => setSearchQuery(event.target.value)}
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

      <div ref={mainLayoutRef} className="flex flex-1 overflow-hidden p-3 gap-3 relative z-10">
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="glass-panel rounded-2xl overflow-hidden flex flex-col flex-shrink-0"
          style={{ width: `${leftPaneWidth}px` }}
        >
          <div className="p-3 border-b border-white/10">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Explorer</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2 scroll-smooth momentum-scroll">
            {isLoadingTree ? (
              <LoadingStack labelOne="Analyzing repository..." labelTwo="Building file map..." />
            ) : (
              <FileTreeView
                nodes={displayedTree}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                onFileClick={handleFileClick}
                selectedPath={selectedFile?.path || null}
                highlightedPaths={highlightedPaths}
                level={0}
              />
            )}
          </div>
        </motion.aside>

        <div
          className={`hidden lg:block w-1 bg-border/70 hover:bg-accent/70 transition-colors cursor-col-resize ${
            draggingPane === 'left' ? 'bg-accent' : ''
          }`}
          onMouseDown={() => setDraggingPane('left')}
          title="Drag to resize explorer"
        />

        <motion.main
          ref={centerPanelRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="flex-1 flex flex-col overflow-hidden glass-panel rounded-2xl relative"
        >
          {isLoadingFile ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingStack labelOne="Loading file..." labelTwo="Preparing context..." />
            </div>
          ) : selectedFile ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center justify-center min-w-10 px-2 h-6 rounded-md border border-white/15 bg-white/5 text-[10px] tracking-wide font-semibold text-zinc-300">
                    {getFileIcon(selectedFile.path)}
                  </span>
                  <span className="text-sm font-medium text-text-primary truncate">{selectedFile.path}</span>
                  <span className="text-xs text-text-secondary bg-background px-2 py-0.5 rounded-full">
                    {selectedFile.language}
                  </span>
                  {fileInsight?.complexity && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/20 bg-white/5 text-zinc-200 uppercase tracking-wider">
                      complexity: {fileInsight.complexity}
                    </span>
                  )}
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
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div
                ref={codeContainerRef}
                className="flex-1 overflow-y-auto overflow-x-auto scroll-smooth momentum-scroll relative center-scrollbar"
                onMouseUp={handleCodeSelection}
              >
                <pre className="p-5 text-sm leading-relaxed shadow-inner shadow-black/20">
                  <code>
                    {selectedFile.content.split('\n').map((line, index) => (
                      <div
                        key={index}
                        data-line={index + 1}
                        className="flex hover:bg-white/5 transition-colors rounded"
                      >
                        <span className="inline-block w-12 text-right pr-4 text-text-secondary/50 select-none flex-shrink-0 font-mono text-xs leading-relaxed">
                          {index + 1}
                        </span>
                        <span className="text-text-primary font-mono whitespace-pre">{line || ' '}</span>
                      </div>
                    ))}
                  </code>
                </pre>

                <AnimatePresence>
                  {selectionExplanation && (
                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 14 }}
                      className="absolute right-4 bottom-4 max-w-md rounded-2xl border border-cyan-200/20 bg-zinc-950/85 backdrop-blur-xl p-4 shadow-2xl"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 className="w-4 h-4 text-cyan-300" />
                        <p className="text-sm font-semibold text-cyan-100">AI explanation</p>
                      </div>
                      <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">{selectionExplanation}</p>
                      <button
                        onClick={() => setSelectionExplanation('')}
                        className="mt-3 text-xs text-zinc-400 hover:text-zinc-100"
                      >
                        Dismiss
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="absolute top-16 right-4 w-[320px] z-20">
                <motion.div layout className="rounded-2xl border border-white/15 bg-zinc-950/65 backdrop-blur-xl p-3 shadow-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-4 h-4 text-cyan-300" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-100">File-level AI insights</p>
                  </div>

                  {isLoadingFileInsight ? (
                    <LoadingStack labelOne="Generating file insight..." labelTwo="Extracting key functions..." compact />
                  ) : fileInsightError ? (
                    <p className="text-[11px] text-amber-300">{fileInsightError}</p>
                  ) : fileInsight ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <p className="text-zinc-400">Purpose</p>
                        <p className="text-zinc-100 leading-relaxed">{fileInsight.purpose}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400">Key functions</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {fileInsight.keyFunctions.slice(0, 4).map((fn) => (
                            <span key={fn.name} className="px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-zinc-100">
                              {fn.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-zinc-400">Suggestions</p>
                        <ul className="space-y-1 mt-1 text-zinc-200">
                          {(fileInsight.patterns || []).slice(0, 3).map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-400">No file insights available yet.</p>
                  )}
                </motion.div>
              </div>

              <CenterChatDock
                chatHeight={chatPanelHeight}
                onResizeStart={() => setIsDraggingChatSlider(true)}
                chatScrollRef={chatScrollRef}
                isLoadingChatHistory={isLoadingChatHistory}
                chatMessages={chatMessages}
                quickPrompts={dynamicQuickPrompts}
                openQuickPrompt={openQuickPrompt}
                chatError={chatError}
                submitChat={submitChat}
                chatInput={chatInput}
                setChatInput={setChatInput}
                selectedFilePath={selectedFile?.path}
                isSendingChat={isSendingChat}
              />
            </>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center px-8 overflow-y-auto center-scrollbar">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center max-w-md"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-400/20 via-blue-500/10 to-indigo-500/20 border border-cyan-200/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(56,189,248,0.2)]"
                  >
                    <Code2 className="w-11 h-11 text-cyan-300" />
                  </motion.div>
                  <h2 className="text-lg font-semibold text-text-primary mb-2">Select a file to analyze</h2>
                  <p className="text-sm text-text-secondary mb-3">Choose any file from the explorer to inspect implementation details.</p>
                  <p className="text-xs text-cyan-200/80">Or ask a question about the codebase in chat.</p>
                </motion.div>
              </div>

              <CenterChatDock
                chatHeight={chatPanelHeight}
                onResizeStart={() => setIsDraggingChatSlider(true)}
                chatScrollRef={chatScrollRef}
                isLoadingChatHistory={isLoadingChatHistory}
                chatMessages={chatMessages}
                quickPrompts={dynamicQuickPrompts}
                openQuickPrompt={openQuickPrompt}
                chatError={chatError}
                submitChat={submitChat}
                chatInput={chatInput}
                setChatInput={setChatInput}
                selectedFilePath={undefined}
                isSendingChat={isSendingChat}
              />
            </>
          )}
        </motion.main>

        <div
          className={`hidden lg:block w-1 bg-border/70 hover:bg-accent/70 transition-colors cursor-col-resize ${
            draggingPane === 'right' ? 'bg-accent' : ''
          }`}
          onMouseDown={() => setDraggingPane('right')}
          title="Drag to resize details panel"
        />

        {metadata && (
          <motion.aside
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="glass-panel rounded-2xl flex flex-col flex-shrink-0 overflow-hidden"
            style={{ width: `${rightPaneWidth}px` }}
          >
            <div className="px-3 pt-3 pb-2 border-b border-white/10">
              <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">AI Insights</h2>
              <div className="grid grid-cols-5 gap-1 rounded-xl bg-zinc-900/40 p-1 border border-white/10">
                <TabButton label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                <TabButton label="Architecture" active={activeTab === 'architecture'} onClick={() => setActiveTab('architecture')} />
                <TabButton label="Insights" active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} />
                <TabButton label="Risks" active={activeTab === 'risks'} onClick={() => setActiveTab('risks')} />
                <TabButton label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 scroll-smooth momentum-scroll">
              {isLoadingOverview ? (
                <LoadingStack labelOne="Analyzing repository..." labelTwo="Generating insights..." />
              ) : overviewError ? (
                <div className="premium-card rounded-xl p-3 border-red-400/40 bg-red-500/10">
                  <p className="text-xs text-red-300 mb-3">{overviewError}</p>
                  <button
                    onClick={fetchOverview}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 hover:border-accent text-text-primary transition-all duration-200"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              ) : overview ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3"
                  >
                    {activeTab === 'overview' && (
                      <OverviewTab
                        overview={overview}
                        reportScores={reportScores}
                        onFocusComplexity={() => handleHighlightFiles(highComplexityFiles, 'Focused high-complexity files')}
                        onFocusModule={(path) => handleHighlightFiles([path], `Focused module: ${path}`)}
                      />
                    )}

                    {activeTab === 'architecture' && (
                      <ArchitectureTab
                        nodes={architectureGraph.nodes}
                        edges={architectureGraph.edges}
                        keyModules={overview.keyModules}
                        onFocusModule={(path) => handleHighlightFiles([path], `Focused module: ${path}`)}
                      />
                    )}

                    {activeTab === 'insights' && (
                      <InsightsTab
                        overview={overview}
                        highComplexityFiles={highComplexityFiles}
                        onFocusComplexity={() => handleHighlightFiles(highComplexityFiles, 'Focused high-complexity files')}
                        onFocusFile={(path) => handleHighlightFiles([path], `Focused file: ${path}`)}
                      />
                    )}

                    {activeTab === 'risks' && (
                      <RisksTab
                        risks={overview.risks || []}
                        evidence={overview.evidence || []}
                        inferFiles={inferRiskFilesForAction}
                        onFocusRisk={(risk) => {
                          const related = inferRiskFilesForAction(risk);
                          handleHighlightFiles(related, `Risk focus: ${risk.title}`);
                        }}
                      />
                    )}

                    {activeTab === 'dashboard' && (
                      <DashboardTab
                        totalFiles={metadata.totalFiles}
                        totalFolders={totalFolders}
                        estimatedLoc={estimatedLoc}
                        dominantLanguage={dominantLanguage}
                        languageChart={languageChart}
                        filesPerFolderData={filesPerFolderData}
                        complexityData={complexityData}
                        folderTreemapData={folderTreemapData}
                        riskBreakdown={riskBreakdown}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </div>

          </motion.aside>
        )}
      </div>

      <AnimatePresence>
        {selectionExplain && (
          <motion.button
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            onClick={explainSelectedCode}
            disabled={isExplainingSelection}
            className="fixed z-50 -translate-x-1/2 -translate-y-full px-3 py-2 rounded-lg border border-cyan-200/25 bg-zinc-950/90 text-xs text-cyan-100 backdrop-blur-xl shadow-xl hover:scale-[1.03] transition-transform disabled:opacity-70"
            style={{ left: selectionExplain.x, top: selectionExplain.y }}
          >
            {isExplainingSelection ? 'Explaining...' : 'Explain this code'}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] py-1.5 rounded-lg transition-all duration-200 ${
        active
          ? 'bg-gradient-to-r from-cyan-400/25 to-blue-500/25 text-cyan-100 border border-cyan-200/20'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  );
}

function LoadingStack({
  labelOne,
  labelTwo,
  compact,
}: {
  labelOne: string;
  labelTwo: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2 p-2">
      {!compact &&
        [...Array(4)].map((_, idx) => (
          <div key={idx} className="h-3 rounded bg-white/10 animate-pulse" style={{ width: `${70 + idx * 6}%` }} />
        ))}
      <p className="text-xs text-zinc-300 animate-pulse">{labelOne}</p>
      <p className="text-[11px] text-zinc-500">{labelTwo}</p>
    </div>
  );
}

function CenterChatDock({
  chatHeight,
  onResizeStart,
  chatScrollRef,
  isLoadingChatHistory,
  chatMessages,
  quickPrompts,
  openQuickPrompt,
  chatError,
  submitChat,
  chatInput,
  setChatInput,
  selectedFilePath,
  isSendingChat,
}: {
  chatHeight: number;
  onResizeStart: () => void;
  chatScrollRef: React.RefObject<HTMLDivElement>;
  isLoadingChatHistory: boolean;
  chatMessages: LocalChatMessage[];
  quickPrompts: string[];
  openQuickPrompt: (prompt: string) => void;
  chatError: string;
  submitChat: (event: FormEvent) => Promise<void>;
  chatInput: string;
  setChatInput: (value: string) => void;
  selectedFilePath?: string;
  isSendingChat: boolean;
}) {
  const contentHeight = Math.max(88, chatHeight - 55);

  return (
    <div className="relative border-t border-white/10 p-2.5 bg-zinc-950/35" style={{ height: `${chatHeight}px` }}>
      <button
        type="button"
        onMouseDown={onResizeStart}
        title="Drag to resize chat section"
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-16 cursor-row-resize rounded-full border border-cyan-200/25 bg-cyan-300/20 hover:bg-cyan-300/35"
      />
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-4 h-4 text-cyan-300" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-200">Chat with Codebase</h3>
      </div>

      <div className="grid grid-cols-[1fr_220px] gap-2" style={{ height: `${contentHeight}px` }}>
        <div ref={chatScrollRef} className="overflow-y-scroll rounded-xl border border-white/10 bg-zinc-950/45 p-2 space-y-2 chat-scrollbar">
          {isLoadingChatHistory ? (
            <LoadingStack labelOne="Loading chat history..." labelTwo="Syncing context..." compact />
          ) : chatMessages.length === 0 ? (
            <div className="text-[11px] text-zinc-400 space-y-1.5">
              <p>Ask context-aware questions:</p>
              {quickPrompts.map((prompt) => (
                <button key={prompt} className="block text-left text-cyan-200 hover:text-cyan-100" onClick={() => openQuickPrompt(prompt)}>
                  • {prompt}
                </button>
              ))}
            </div>
          ) : (
            chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg px-2 py-1.5 text-[11px] leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-cyan-400/10 border border-cyan-200/20 text-cyan-50'
                    : 'bg-white/5 border border-white/10 text-zinc-100'
                }`}
              >
                <p className="font-semibold mb-0.5 opacity-80">{msg.role === 'assistant' ? 'AI' : 'You'}</p>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))
          )}
        </div>

        <div>
          <form onSubmit={submitChat} className="h-full flex flex-col gap-2">
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              rows={3}
              placeholder={selectedFilePath ? `Ask about ${selectedFilePath}` : 'Ask about this codebase'}
              className="flex-1 resize-none rounded-xl border border-white/10 bg-zinc-900/65 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            />
            <button
              type="submit"
              disabled={isSendingChat || !chatInput.trim()}
              className="h-8 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 text-white disabled:opacity-60 transition-transform hover:scale-[1.02] text-xs"
            >
              {isSendingChat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Ask
            </button>
          </form>
          {chatError && <p className="text-[11px] text-amber-300 mt-1">{chatError}</p>}
        </div>
      </div>
    </div>
  );
}

function buildDynamicQuickPrompts({
  sessionId,
  seed,
  metadata,
  overview,
  selectedFilePath,
  highComplexityFiles,
}: {
  sessionId: string;
  seed: number;
  metadata: RepoMetadata | null;
  overview: ArchitectureOverview | null;
  selectedFilePath?: string;
  highComplexityFiles: string[];
}): string[] {
  const repoName = metadata?.name || 'this repository';
  const topLang = metadata
    ? Object.entries(metadata.languages).sort(([, a], [, b]) => b - a)[0]?.[0]
    : undefined;
  const topLangLabel = topLang ? prettyPrintLanguage(topLang) : undefined;
  const firstRisk = overview?.risks?.[0]?.title;
  const firstModule = overview?.keyModules?.[0]?.name;
  const firstEntry = overview?.detectedEntryPoints?.[0];
  const complexityTarget = highComplexityFiles[0];

  const promptPool = [
    `What is ${repoName} mainly responsible for?`,
    selectedFilePath ? `Explain ${selectedFilePath} in simple terms.` : 'Explain the most important file in this repository.',
    firstEntry ? `How does ${firstEntry} connect to the rest of the codebase?` : 'Where is the main entry point and startup flow?',
    firstModule ? `What does the module "${firstModule}" do and why is it important?` : 'Which module contains the core business logic?',
    firstRisk ? `How should we mitigate this risk: ${firstRisk}?` : 'What are the top high-risk areas in this codebase?',
    complexityTarget ? `Why is ${complexityTarget} considered complex and how can we simplify it?` : 'Which files look most complex and why?',
    topLangLabel ? `What ${topLangLabel} patterns are used here, and are they consistent?` : 'What coding patterns are used most in this repository?',
    'Give me a 3-step plan to improve maintainability.',
    'Which files should I read first to understand the full flow?',
    'If I am onboarding today, what should I understand first?'
  ];

  const unique = Array.from(new Set(promptPool.filter(Boolean)));
  const mixed = seededShuffle(unique, `${sessionId}-${seed}`);
  return mixed.slice(0, 4);
}

function seededShuffle<T>(items: T[], seedText: string): T[] {
  let seed = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
  }

  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}

function OverviewTab({
  overview,
  reportScores,
  onFocusComplexity,
  onFocusModule,
}: {
  overview: ArchitectureOverview;
  reportScores: Array<{
    key: string;
    value: number;
    tooltip: string;
    colorFrom: string;
    colorTo: string;
  }>;
  onFocusComplexity: () => void;
  onFocusModule: (path: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-cyan-300" />
          <p className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">Overview</p>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">{overview.summary}</p>

        {overview.executiveBullets && overview.executiveBullets.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-zinc-200">
            {overview.executiveBullets.slice(0, 5).map((point, idx) => (
              <li key={`${point}-${idx}`}>• {point}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">Scorecard</p>
          <button
            onClick={onFocusComplexity}
            className="text-[11px] px-2 py-0.5 rounded border border-amber-300/30 text-amber-200 hover:bg-amber-300/10"
          >
            Focus high complexity
          </button>
        </div>

        <div className="space-y-3">
          {reportScores.map((score) => (
            <AnimatedScoreBar
              key={score.key}
              label={score.key}
              value={score.value}
              tooltip={score.tooltip}
              colorFrom={score.colorFrom}
              colorTo={score.colorTo}
            />
          ))}
        </div>
      </div>

      <CollapsibleTextSection title="Project profile">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <StatChip label="Pattern" value={overview.pattern} />
          <StatChip label="Project Type" value={overview.projectType} />
          <StatChip label="Framework" value={overview.framework || 'N/A'} />
          <StatChip label="Confidence" value={`${overview.confidence ?? 0}%`} />
        </div>
      </CollapsibleTextSection>

      <CollapsibleTextSection title="Key modules">
        <div className="space-y-2">
          {overview.keyModules.slice(0, 6).map((module) => (
            <button
              key={`${module.path}-${module.name}`}
              onClick={() => onFocusModule(module.path)}
              className="w-full text-left rounded-lg border border-white/10 bg-zinc-900/50 p-2 hover:border-cyan-200/30"
            >
              <p className="text-xs font-medium text-zinc-100">{module.name}</p>
              <p className="text-[11px] text-cyan-200 break-all">{module.path}</p>
              <p className="text-[11px] text-zinc-400 mt-1">{module.responsibility}</p>
            </button>
          ))}
        </div>
      </CollapsibleTextSection>
    </div>
  );
}

function ArchitectureTab({
  nodes,
  edges,
  keyModules,
  onFocusModule,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  keyModules: ArchitectureOverview['keyModules'];
  onFocusModule: (path: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-zinc-950/45 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-cyan-300" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-100">Module flow</p>
        </div>
        <div className="h-64 rounded-lg border border-white/10 overflow-hidden bg-gradient-to-b from-zinc-900/70 to-zinc-950/90">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Controls showInteractive={false} />
            <Background gap={20} color="#1f2937" />
          </ReactFlow>
        </div>
      </div>

      <CollapsibleTextSection title="Module relationships">
        <div className="space-y-2">
          {keyModules.slice(0, 8).map((module) => (
            <button
              key={module.path}
              onClick={() => onFocusModule(module.path)}
              className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-left hover:border-cyan-200/30"
            >
              <p className="text-xs text-zinc-100 font-medium">{module.name}</p>
              <p className="text-[11px] text-cyan-200 break-all">{module.path}</p>
            </button>
          ))}
        </div>
      </CollapsibleTextSection>
    </div>
  );
}

function InsightsTab({
  overview,
  highComplexityFiles,
  onFocusComplexity,
  onFocusFile,
}: {
  overview: ArchitectureOverview;
  highComplexityFiles: string[];
  onFocusComplexity: () => void;
  onFocusFile: (path: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-100">High-complexity hot spots</p>
          <button
            onClick={onFocusComplexity}
            className="text-[11px] px-2 py-0.5 rounded border border-cyan-300/30 text-cyan-200 hover:bg-cyan-300/10"
          >
            Highlight in explorer
          </button>
        </div>

        {highComplexityFiles.length === 0 ? (
          <p className="text-xs text-zinc-400">No high-complexity files inferred from current evidence.</p>
        ) : (
          <div className="space-y-1.5">
            {highComplexityFiles.slice(0, 6).map((file) => (
              <button
                key={file}
                onClick={() => onFocusFile(file)}
                className="w-full text-left text-xs rounded-lg border border-white/10 bg-zinc-900/50 px-2 py-1.5 text-zinc-200 hover:border-cyan-200/35"
              >
                {file}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <LineChart className="w-4 h-4 text-emerald-300" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-100">Evidence highlights</p>
        </div>

        <div className="space-y-2">
          {(overview.evidence || []).slice(0, 6).map((item, idx) => (
            <button
              key={`${item.filePath}-${idx}`}
              onClick={() => onFocusFile(item.filePath)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900/50 p-2 text-left hover:border-emerald-200/30"
            >
              <p className="text-[11px] text-emerald-200 break-all">{item.filePath}</p>
              <p className="text-xs text-zinc-100 mt-1">{item.finding}</p>
              <p className="text-[11px] text-zinc-400 mt-1">{item.relevance}</p>
            </button>
          ))}
        </div>
      </div>

      <CollapsibleTextSection title="Deep-dive notes">
        <div className="space-y-2 text-xs text-zinc-300 leading-relaxed">
          <p>• Runtime flow: {overview.deepDive?.runtimeFlow || 'N/A'}</p>
          <p>• Data lifecycle: {overview.deepDive?.dataLifecycle || 'N/A'}</p>
          <p>• Quality signals: {overview.deepDive?.qualitySignals || 'N/A'}</p>
        </div>
      </CollapsibleTextSection>
    </div>
  );
}

function RisksTab({
  risks,
  evidence,
  inferFiles,
  onFocusRisk,
}: {
  risks: AnalysisRisk[];
  evidence: EvidenceItem[];
  inferFiles: (risk: AnalysisRisk) => string[];
  onFocusRisk: (risk: AnalysisRisk) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-rose-300" />
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-100">Risk register</p>
        </div>

        {risks.length === 0 ? (
          <p className="text-xs text-zinc-400">No explicit risks returned by analysis.</p>
        ) : (
          <div className="space-y-2">
            {risks.slice(0, 8).map((risk, idx) => {
              const files = inferFiles(risk);
              return (
                <div key={`${risk.title}-${idx}`} className="rounded-lg border border-white/10 bg-zinc-900/45 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-zinc-100">{risk.title}</p>
                    <span className="text-[10px] uppercase text-zinc-300 rounded-full px-2 py-0.5 border border-white/20">
                      {risk.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-1">{risk.detail}</p>
                  <p className="text-[11px] text-cyan-200 mt-1">Mitigation: {risk.mitigation}</p>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-zinc-400">Affected files: {files.length}</span>
                    <button
                      onClick={() => onFocusRisk(risk)}
                      className="text-[11px] px-2 py-0.5 rounded border border-rose-300/30 text-rose-200 hover:bg-rose-300/10"
                    >
                      Show affected files
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CollapsibleTextSection title="Evidence references">
        <div className="space-y-2">
          {evidence.slice(0, 6).map((item, idx) => (
            <div key={`${item.filePath}-risk-${idx}`} className="rounded-lg border border-white/10 bg-zinc-900/50 p-2">
              <p className="text-[11px] text-cyan-200 break-all">{item.filePath}</p>
              <p className="text-xs text-zinc-200 mt-1">{item.finding}</p>
            </div>
          ))}
        </div>
      </CollapsibleTextSection>
    </div>
  );
}

function DashboardTab({
  totalFiles,
  totalFolders,
  estimatedLoc,
  dominantLanguage,
  languageChart,
  filesPerFolderData,
  complexityData,
  folderTreemapData,
  riskBreakdown,
}: {
  totalFiles: number;
  totalFolders: number;
  estimatedLoc: number;
  dominantLanguage: string;
  languageChart: Array<{ name: string; value: number; color: string }>;
  filesPerFolderData: Array<{ folder: string; files: number }>;
  complexityData: Array<{ path: string; complexity: number }>;
  folderTreemapData: Array<{ name: string; size: number }>;
  riskBreakdown: { high: number; medium: number; low: number };
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard icon={<FileSearch className="w-4 h-4 text-cyan-300" />} label="Total files" value={totalFiles.toString()} />
        <MetricCard icon={<Layers className="w-4 h-4 text-emerald-300" />} label="Total folders" value={totalFolders.toString()} />
        <MetricCard icon={<Code2 className="w-4 h-4 text-amber-300" />} label="Estimated LOC" value={estimatedLoc.toLocaleString()} />
        <MetricCard icon={<PieChartIcon className="w-4 h-4 text-indigo-300" />} label="Dominant language" value={dominantLanguage} />
      </div>

      <ChartCard title="Language distribution" icon={<PieChartIcon className="w-4 h-4 text-cyan-300" />}>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={languageChart} dataKey="value" nameKey="name" outerRadius={68} innerRadius={34}>
                {languageChart.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Files per folder" icon={<BarChart3 className="w-4 h-4 text-emerald-300" />}>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filesPerFolderData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="folder" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <RechartsTooltip />
              <Bar dataKey="files" fill="#22c55e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Complexity by file" icon={<BrainCircuit className="w-4 h-4 text-amber-300" />}>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={complexityData} layout="vertical" margin={{ left: 40, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="path" width={120} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <RechartsTooltip />
              <Bar dataKey="complexity" fill="#f59e0b" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Folder contribution" icon={<Layers className="w-4 h-4 text-indigo-300" />}>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={folderTreemapData}
              dataKey="size"
              stroke="#0f172a"
              fill="#3b82f6"
              animationDuration={450}
            />
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-100 mb-2">Risk breakdown</p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <StatTile label="High" value={riskBreakdown.high.toString()} tone="rose" />
          <StatTile label="Medium" value={riskBreakdown.medium.toString()} tone="amber" />
          <StatTile label="Low" value={riskBreakdown.low.toString()} tone="emerald" />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/45 p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-100">{title}</p>
      </div>
      {children}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/50 p-2.5">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] text-zinc-400">{label}</p>
      </div>
      <p className="text-sm text-zinc-100 font-semibold mt-1 truncate">{value}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-2">
      <p className="text-zinc-400">{label}</p>
      <p className="text-zinc-100 mt-1 truncate">{value}</p>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'rose' | 'amber' | 'emerald';
}) {
  const map: Record<'rose' | 'amber' | 'emerald', string> = {
    rose: 'border-rose-300/25 bg-rose-400/10 text-rose-100',
    amber: 'border-amber-300/25 bg-amber-400/10 text-amber-100',
    emerald: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
  };

  return (
    <div className={`rounded-lg border p-2 ${map[tone]}`}>
      <p className="text-[11px] opacity-75">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function AnimatedScoreBar({
  label,
  value,
  tooltip,
  colorFrom,
  colorTo,
}: {
  label: string;
  value: number;
  tooltip: string;
  colorFrom: string;
  colorTo: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-zinc-200">{label}</span>
          <span title={tooltip} className="text-zinc-500 hover:text-zinc-300 cursor-help">
            <Info className="w-3 h-3" />
          </span>
        </div>
        <span className="text-[11px] text-zinc-100 font-semibold">{clamped}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-900/90 overflow-hidden border border-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full shadow-[0_0_14px_rgba(34,211,238,0.35)]"
          style={{ background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})` }}
        />
      </div>
    </div>
  );
}

function CollapsibleTextSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-white/10 bg-zinc-950/45 p-2.5 group" open>
      <summary className="list-none cursor-pointer flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-100">{title}</span>
        <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function FileTreeView({
  nodes,
  expandedFolders,
  onToggleFolder,
  onFileClick,
  selectedPath,
  highlightedPaths,
  level,
}: {
  nodes: FileNode[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileClick: (path: string) => void;
  selectedPath: string | null;
  highlightedPaths: Set<string>;
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
          highlightedPaths={highlightedPaths}
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
  highlightedPaths,
  level,
}: {
  node: FileNode;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileClick: (path: string) => void;
  selectedPath: string | null;
  highlightedPaths: Set<string>;
  level: number;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedPath === node.path;
  const isDirectory = node.type === 'directory';
  const isHighlighted = highlightedPaths.has(node.path);

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
            : isHighlighted
              ? 'bg-cyan-400/12 text-cyan-100 border-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.25)]'
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
              highlightedPaths={highlightedPaths}
              level={level + 1}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function flattenFileNodes(nodes: FileNode[]): Array<{ path: string }> {
  const files: Array<{ path: string }> = [];

  const walk = (items: FileNode[]) => {
    items.forEach((item) => {
      if (item.type === 'file') {
        files.push({ path: item.path });
      } else if (item.children) {
        walk(item.children);
      }
    });
  };

  walk(nodes);
  return files;
}

function countDirectories(nodes: FileNode[]): number {
  let count = 0;

  const walk = (items: FileNode[]) => {
    items.forEach((item) => {
      if (item.type === 'directory') {
        count += 1;
        if (item.children) {
          walk(item.children);
        }
      }
    });
  };

  walk(nodes);
  return count;
}

function inferComplexityByFile(
  overview: ArchitectureOverview | null,
  files: Array<{ path: string }>
): Array<{ path: string; complexity: number }> {
  const scoreMap: Record<string, number> = {};

  const bump = (path: string, amount: number) => {
    if (!path) {
      return;
    }
    scoreMap[path] = Math.min(100, (scoreMap[path] || 0) + amount);
  };

  (overview?.evidence || []).forEach((evidence) => {
    let delta = 20;
    const text = `${evidence.finding} ${evidence.relevance}`.toLowerCase();
    if (text.includes('complex')) {
      delta += 25;
    }
    if (text.includes('security')) {
      delta += 10;
    }
    bump(evidence.filePath, delta);
  });

  (overview?.risks || []).forEach((risk) => {
    const severityBoost = risk.severity === 'high' ? 28 : risk.severity === 'medium' ? 18 : 8;
    const related = inferRiskFiles(risk, overview?.evidence || [], files);
    related.forEach((path) => bump(path, severityBoost));
  });

  if (Object.keys(scoreMap).length === 0) {
    files.slice(0, 8).forEach((f, index) => {
      scoreMap[f.path] = 40 - index;
    });
  }

  return Object.entries(scoreMap)
    .map(([path, complexity]) => ({ path: trimPath(path), complexity }))
    .sort((a, b) => b.complexity - a.complexity);
}

function inferRiskFiles(
  risk: AnalysisRisk,
  evidence: EvidenceItem[],
  files: Array<{ path: string }>
): string[] {
  const tokens = `${risk.title} ${risk.detail}`
    .toLowerCase()
    .split(/[^a-z0-9/_.-]+/)
    .filter((token) => token.length > 4);

  const matched = evidence
    .filter((item) => {
      const blob = `${item.finding} ${item.relevance} ${item.filePath}`.toLowerCase();
      return tokens.some((token) => blob.includes(token));
    })
    .map((item) => item.filePath);

  if (matched.length > 0) {
    return Array.from(new Set(matched)).slice(0, 10);
  }

  return files.slice(0, 5).map((item) => item.path);
}

function buildArchitectureGraph(steps: string[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const fallbackSteps = steps.length > 0 ? steps : ['Input', 'Processing', 'Model', 'Output'];

  const nodes: FlowNode[] = fallbackSteps.map((step, index) => ({
    id: `${index}`,
    position: { x: 40 + index * 190, y: 90 + ((index % 2) * 40) },
    data: { label: step },
    style: {
      borderRadius: 16,
      border: '1px solid rgba(103, 232, 249, 0.35)',
      background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(15,23,42,0.65))',
      color: '#e2e8f0',
      padding: '10px 12px',
      boxShadow: '0 0 24px rgba(34,211,238,0.12)',
      fontSize: 11,
      width: 150,
      textAlign: 'center',
    },
  }));

  const edges: FlowEdge[] = fallbackSteps.slice(0, -1).map((_, index) => ({
    id: `e-${index}-${index + 1}`,
    source: `${index}`,
    target: `${index + 1}`,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#22d3ee' },
    style: { stroke: '#22d3ee', strokeWidth: 1.5 },
    animated: true,
  }));

  return { nodes, edges };
}

function trimPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.length <= 26) {
    return normalized;
  }
  return `...${normalized.slice(-26)}`;
}

function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    typescript: '#3178c6',
    javascript: '#f1e05a',
    python: '#3572a5',
    java: '#b07219',
    html: '#e34c26',
    css: '#663399',
    json: '#64748b',
    markdown: '#0ea5e9',
    go: '#00add8',
    rust: '#dea584',
    ruby: '#701516',
    php: '#4f5d95',
    csharp: '#178600',
    cpp: '#f34b7d',
    c: '#555555',
    shell: '#89e051',
    sql: '#e38c00',
    plaintext: '#64748b',
    vue: '#41b883',
    svelte: '#ff3e00',
    scss: '#c6538c',
    yaml: '#cb171e',
  };

  return colors[language] || '#58a6ff';
}
