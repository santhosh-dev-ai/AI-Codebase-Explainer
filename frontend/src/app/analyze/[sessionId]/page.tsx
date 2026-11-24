'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/config';
import { prettyPrintLanguage } from '@/lib/utils';
import type { FileNode, RepoMetadata } from '@/types/codebase.types';
import type { ArchitectureOverview, AnalysisRisk, FileExplanation } from '@/types/analysis.types';
import {
  type FileTreeData,
  type FileContentData,
  type WorkspaceMainView,
  type InspectorTab,
  type MobileTab,
  type LocalChatMessage,
} from '@/components/workspace/workspace.types';
import {
  flattenFileNodes,
  countDirectories,
  inferComplexityByFile,
  inferRiskFiles,
  buildArchitectureGraph,
  buildDynamicQuickPrompts,
  getLanguageColor,
} from '@/components/workspace/workspace.utils';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { ExplorerPane } from '@/components/workspace/ExplorerPane';
import { CodeViewerPane } from '@/components/workspace/CodeViewerPane';
import { ArchitectureView } from '@/components/workspace/ArchitectureView';
import { OverviewCenterView } from '@/components/workspace/OverviewCenterView';
import { RisksCenterView } from '@/components/workspace/RisksCenterView';
import { MetricsCenterView } from '@/components/workspace/MetricsCenterView';
import { UnifiedAIInspector } from '@/components/workspace/UnifiedAIInspector';
import { CenterChatDock } from '@/components/workspace/CenterChatDock';
import { AlertCircle } from 'lucide-react';

interface AnalyzePageProps {
  params: { sessionId: string };
}

export default function AnalyzePage({ params }: AnalyzePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView = (searchParams.get('view') as WorkspaceMainView) || 'code';
  const initialChatOpen = searchParams.get('chat') === 'open';
  const { sessionId } = params;

  const mainLayoutRef = useRef<HTMLDivElement | null>(null);
  const centerPanelRef = useRef<HTMLElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // 1. Primary Workspace Views State (Only ONE active at a time!)
  const [activeMainView, setActiveMainView] = useState<WorkspaceMainView>(initialView);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('explain');
  const [mobileTab, setMobileTab] = useState<MobileTab>('main');

  // 2. Panel Visibility State (collapsible)
  const [isExplorerOpen, setIsExplorerOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(initialChatOpen); // Collapsed by default as per Part 3

  // 3. Resizable Panels State
  const [leftPaneWidth, setLeftPaneWidth] = useState(270);
  const [rightPaneWidth, setRightPaneWidth] = useState(360);
  const [draggingPane, setDraggingPane] = useState<'left' | 'right' | null>(null);
  const [chatPanelHeight, setChatPanelHeight] = useState(220);
  const [isDraggingChatSlider, setIsDraggingChatSlider] = useState(false);

  // 4. Repository & File Tree State
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [metadata, setMetadata] = useState<RepoMetadata | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [treeError, setTreeError] = useState('');

  // 5. Overview & Architecture State
  const [overview, setOverview] = useState<ArchitectureOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  // 6. Selected File State
  const [selectedFile, setSelectedFile] = useState<FileContentData | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // 7. Contextual File AI Explanation State
  const [fileInsight, setFileInsight] = useState<FileExplanation | null>(null);
  const [isLoadingFileInsight, setIsLoadingFileInsight] = useState(false);
  const [fileInsightError, setFileInsightError] = useState('');
  const fileInsightCache = useRef<Map<string, FileExplanation>>(new Map());

  // 8. Search & Focus Highlights State
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedPaths, setHighlightedPaths] = useState<Set<string>>(new Set());
  const [highlightReason, setHighlightReason] = useState('');

  // 9. Code Snippet Selection AI Explanation State
  const [isExplainingSelection, setIsExplainingSelection] = useState(false);
  const [selectionExplanation, setSelectionExplanation] = useState('');

  // 10. Chat State
  const [chatMessages, setChatMessages] = useState<LocalChatMessage[]>([]);
  const [isLoadingChatHistory, setIsLoadingChatHistory] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [promptSeed] = useState(() => Date.now());

  // Helper: Find initial file to preview (prefer README)
  const findInitialFile = useCallback((nodes: FileNode[]): string | null => {
    for (const node of nodes) {
      if (node.type === 'file' && /readme/i.test(node.name)) return node.path;
    }
    for (const node of nodes) {
      if (node.type === 'file') return node.path;
      if (node.children) {
        const found = findInitialFile(node.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Fetch File Content & Trigger Contextual Analysis
  const handleFileClick = useCallback(
    async (filePath: string, preserveView = false) => {
      try {
        setIsLoadingFile(true);
        setSelectionExplanation('');
        if (!preserveView) {
          setActiveMainView('code'); // Switch center workspace to Code Viewer
        }
        setMobileTab('main');

        const response = await apiClient.get<FileContentData>(API_ENDPOINTS.GET_FILE(sessionId), {
          filePath,
        });

        if (response.data) {
          setSelectedFile(response.data);
          // Auto switch inspector to Explain tab for this file
          setActiveInspectorTab('explain');
        }
      } catch (err) {
        console.error('Failed to load file:', err);
      } finally {
        setIsLoadingFile(false);
      }
    },
    [sessionId]
  );

  // Fetch File Tree
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

        // Auto-select initial file without overriding explicit query view
        const initial = findInitialFile(response.data.fileTree);
        if (initial) {
          handleFileClick(initial, initialView !== 'code');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load file tree';
      if (/session not found|session expired/i.test(message)) {
        router.replace('/?error=session-expired');
        return;
      }
      setTreeError(message);
    } finally {
      setIsLoadingTree(false);
    }
  }, [sessionId, router, findInitialFile, handleFileClick, initialView]);

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  // Fetch Contextual File AI Insight
  const fetchFileInsight = useCallback(
    async (filePathToFetch?: string) => {
      const targetPath = filePathToFetch || selectedFile?.path;
      if (!targetPath) {
        setFileInsight(null);
        setFileInsightError('');
        return;
      }

      if (fileInsightCache.current.has(targetPath)) {
        setFileInsight(fileInsightCache.current.get(targetPath)!);
        setFileInsightError('');
        return;
      }

      try {
        setIsLoadingFileInsight(true);
        setFileInsightError('');

        const response = await apiClient.post<{
          fileExplanation?: FileExplanation;
          explanation?: FileExplanation;
        }>(API_ENDPOINTS.FILE_EXPLANATION(sessionId), { filePath: targetPath });

        const explanation = response.data?.fileExplanation || response.data?.explanation || null;
        if (explanation) {
          fileInsightCache.current.set(targetPath, explanation);
        }
        setFileInsight(explanation);
      } catch (err) {
        setFileInsight(null);
        setFileInsightError(err instanceof Error ? err.message : 'File insight unavailable');
      } finally {
        setIsLoadingFileInsight(false);
      }
    },
    [sessionId, selectedFile?.path]
  );

  useEffect(() => {
    if (selectedFile?.path) {
      fetchFileInsight(selectedFile.path);
    } else {
      setFileInsight(null);
      setFileInsightError('');
    }
  }, [selectedFile?.path, fetchFileInsight]);

  // Toggle Folder in Explorer
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

  const expandAllFolders = useCallback(() => {
    const allDirs: string[] = [];
    const walk = (nodes: FileNode[]) => {
      nodes.forEach((n) => {
        if (n.type === 'directory') {
          allDirs.push(n.path);
          if (n.children) walk(n.children);
        }
      });
    };
    walk(fileTree);
    setExpandedFolders(new Set(allDirs));
  }, [fileTree]);

  const collapseAllFolders = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  // Fetch Repository Architecture Overview
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
      setOverviewError(err instanceof Error ? err.message : 'Failed to load architecture overview');
    } finally {
      setIsLoadingOverview(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Fetch Chat History
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

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isLoadingChatHistory]);

  // Keyboard Shortcuts (Ctrl+B / Ctrl+I / Ctrl+K / Ctrl+F)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsExplorerOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Panel Resizing Handlers
  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingPane && !isDraggingChatSlider) return;

      if (draggingPane && mainLayoutRef.current) {
        const rect = mainLayoutRef.current.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const minLeft = 200;
        const maxLeft = 450;
        const minRight = 280;
        const maxRight = 550;
        const minCenter = 350;

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
        const clamped = Math.max(140, Math.min(380, Math.round(desiredHeight)));
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

  // Tree Filtering
  const filterTree = useCallback((nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes;
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
    if (!metadata) return 0;
    return Math.round(metadata.totalSize / 42);
  }, [metadata]);

  const dominantLanguage = useMemo(() => {
    if (!metadata) return 'Unknown';
    const dominant = Object.entries(metadata.languages).sort(([, a], [, b]) => b - a)[0]?.[0];
    return dominant ? prettyPrintLanguage(dominant) : 'Unknown';
  }, [metadata]);

  const reportScores = useMemo(() => {
    if (!overview?.scorecard) return [];
    return [
      {
        key: 'Architecture',
        tooltip: 'Structural decoupling and module boundary cleanliness.',
        value: overview.scorecard.architecture,
        colorFrom: '#06b6d4',
        colorTo: '#3b82f6',
      },
      {
        key: 'Maintainability',
        tooltip: 'Ease of refactoring, cohesion, and cognitive overhead.',
        value: overview.scorecard.maintainability,
        colorFrom: '#10b981',
        colorTo: '#059669',
      },
      {
        key: 'Complexity',
        tooltip: 'Density of recursive branching and deeply nested control flows.',
        value: overview.scorecard.complexity,
        colorFrom: '#f59e0b',
        colorTo: '#ef4444',
      },
      {
        key: 'Security',
        tooltip: 'Hardening, sanitization patterns, and dependency safety.',
        value: overview.scorecard.security,
        colorFrom: '#f43f5e',
        colorTo: '#e11d48',
      },
    ];
  }, [overview?.scorecard]);

  const languageChart = useMemo(() => {
    if (!metadata) return [];
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
        acc[risk.severity] = (acc[risk.severity] || 0) + 1;
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
    return complexityData
      .filter((item) => item.complexity >= 65)
      .map((item) => item.path)
      .slice(0, 8);
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

  // Send AI Chat Message
  const sendChatMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim()) return;

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
          ? 'Session expired. Please re-analyze repository.'
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
      if (chatError) setChatError('');
    },
    [chatError]
  );

  // Explain snippet selection
  const explainSnippet = useCallback(
    async (snippet: string) => {
      if (!selectedFile) return;

      setIsExplainingSelection(true);
      setSelectionExplanation('');

      try {
        const prompt = `Explain this snippet from ${selectedFile.path}:\n\`\`\`${selectedFile.language}\n${snippet}\n\`\`\``;
        const response = await apiClient.post<{
          response?: string;
          answer?: string;
          message?: string;
        }>(API_ENDPOINTS.CHAT_MESSAGE(sessionId), {
          message: prompt,
          context: {
            currentFile: selectedFile.path,
            selectedCode: snippet,
          },
        });

        const text =
          response.data?.response ||
          response.data?.answer ||
          response.data?.message ||
          'Snippet explained.';

        setSelectionExplanation(text);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `u-sel-${Date.now()}`,
            role: 'user',
            content: `Explain selected code snippet in ${selectedFile.path}`,
            timestamp: new Date(),
          },
          {
            id: `a-sel-${Date.now()}`,
            role: 'assistant',
            content: text,
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        setSelectionExplanation(
          err instanceof Error ? err.message : 'Failed to explain snippet'
        );
      } finally {
        setIsExplainingSelection(false);
      }
    },
    [sessionId, selectedFile]
  );

  const handleAskAboutSelection = (snippet: string) => {
    setIsChatOpen(true);
    setChatInput(`Regarding this code from ${selectedFile?.path}:\n"${snippet.slice(0, 120)}..."\nHow does this work?`);
  };

  if (treeError) {
    return (
      <div className="h-screen flex items-center justify-center bg-void p-6 font-mono">
        <div className="text-center max-w-md p-6 rounded-2xl border border-white/10 bg-surface/80 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-rose-400" />
          </div>
          <h1 className="text-base font-bold text-white mb-2">Session Error</h1>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed font-sans">{treeError}</p>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-void rounded-xl font-semibold text-xs transition-all shadow-[0_0_12px_rgba(34,211,238,0.25)]"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-void text-zinc-100 overflow-hidden font-sans">
      {/* 1. Header (Compact, modern status & view switcher) */}
      <WorkspaceHeader
        sessionId={sessionId}
        metadata={metadata}
        selectedFilePath={selectedFile?.path}
        activeView={activeMainView}
        onSelectView={setActiveMainView}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((prev) => !prev)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        highlightedCount={highlightedPaths.size}
        highlightReason={highlightReason}
        onClearHighlights={clearHighlights}
        isExplorerOpen={isExplorerOpen}
        onToggleExplorer={() => setIsExplorerOpen((prev) => !prev)}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
        isChatOpen={isChatOpen}
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        mobileActiveTab={mobileTab}
        onSelectMobileTab={setMobileTab}
      />

      {/* 2. Main 3-Panel Workspace Layout */}
      <div ref={mainLayoutRef} className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Panel: File Explorer */}
        {isExplorerOpen && (
          <div
            style={{ width: `${leftPaneWidth}px` }}
            className={`h-full flex-shrink-0 ${
              mobileTab === 'explorer' ? 'flex w-full lg:w-auto' : 'hidden lg:flex'
            }`}
          >
            <ExplorerPane
              nodes={displayedTree}
              isLoading={isLoadingTree}
              expandedFolders={expandedFolders}
              onToggleFolder={toggleFolder}
              onFileClick={handleFileClick}
              selectedPath={selectedFile?.path || null}
              highlightedPaths={highlightedPaths}
              onExpandAll={expandAllFolders}
              onCollapseAll={collapseAllFolders}
            />
          </div>
        )}

        {/* Resizer Handle: Left */}
        {isExplorerOpen && (
          <div
            className={`hidden lg:block w-1 hover:w-1.5 bg-white/5 hover:bg-cyan-400/50 cursor-col-resize transition-all ${
              draggingPane === 'left' ? 'bg-cyan-400' : ''
            }`}
            onMouseDown={() => setDraggingPane('left')}
            title="Drag to resize explorer"
          />
        )}

        {/* Center Panel: Main Workspace Content (Only ONE active at a time!) */}
        <main
          ref={centerPanelRef}
          className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative ${
            mobileTab === 'main' || mobileTab === 'chat'
              ? 'flex'
              : 'hidden lg:flex'
          }`}
        >
          {/* Primary Main Content View (Only ONE active view!) */}
          <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
            {activeMainView === 'code' && (
              <CodeViewerPane
                selectedFile={selectedFile}
                isLoadingFile={isLoadingFile}
                onExplainSelection={explainSnippet}
                onAskAboutSelection={handleAskAboutSelection}
                isExplainingSelection={isExplainingSelection}
                selectionExplanation={selectionExplanation}
                onDismissSelectionExplanation={() => setSelectionExplanation('')}
                onOpenInspectorTab={(tab) => {
                  setIsInspectorOpen(true);
                  setActiveInspectorTab(tab);
                }}
              />
            )}

            {activeMainView === 'architecture' && (
              <ArchitectureView
                sessionId={sessionId}
                nodes={architectureGraph.nodes}
                edges={architectureGraph.edges}
                keyModules={overview?.keyModules || []}
                onNavigateToFile={handleFileClick}
                dataFlowDescription={overview?.dataFlow}
                overview={overview}
                fileTree={fileTree}
              />
            )}

            {activeMainView === 'overview' && (
              <OverviewCenterView
                overview={overview}
                reportScores={reportScores}
                onFocusComplexity={() => {
                  handleHighlightFiles(highComplexityFiles, 'Focused complexity hot spots');
                  setIsExplorerOpen(true);
                }}
                onNavigateToFile={handleFileClick}
                isLoading={isLoadingOverview}
              />
            )}

            {activeMainView === 'risks' && (
              <RisksCenterView
                risks={overview?.risks || []}
                evidence={overview?.evidence || []}
                inferFiles={inferRiskFilesForAction}
                onFocusRisk={(risk) => {
                  const related = inferRiskFilesForAction(risk);
                  handleHighlightFiles(related, `Risk: ${risk.title}`);
                  setIsExplorerOpen(true);
                }}
                onNavigateToFile={handleFileClick}
              />
            )}

            {activeMainView === 'metrics' && (
              <MetricsCenterView
                totalFiles={metadata?.totalFiles || 0}
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
          </div>

          {/* Collapsible Bottom AI Chat Dock */}
          <CenterChatDock
            isOpen={mobileTab === 'chat' || isChatOpen}
            onToggleOpen={() => setIsChatOpen((prev) => !prev)}
            chatHeight={mobileTab === 'chat' ? 500 : chatPanelHeight}
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
        </main>

        {/* Resizer Handle: Right */}
        {isInspectorOpen && (
          <div
            className={`hidden lg:block w-1 hover:w-1.5 bg-white/5 hover:bg-cyan-400/50 cursor-col-resize transition-all ${
              draggingPane === 'right' ? 'bg-cyan-400' : ''
            }`}
            onMouseDown={() => setDraggingPane('right')}
            title="Drag to resize inspector"
          />
        )}

        {/* Right Panel: ONE Contextual Unified AI Inspector */}
        {isInspectorOpen && (
          <div
            style={{ width: `${rightPaneWidth}px` }}
            className={`h-full flex-shrink-0 ${
              mobileTab === 'inspector' ? 'flex w-full lg:w-auto' : 'hidden lg:flex'
            }`}
          >
            <UnifiedAIInspector
              activeTab={activeInspectorTab}
              onSelectTab={setActiveInspectorTab}
              selectedFilePath={selectedFile?.path}
              fileInsight={fileInsight}
              isLoadingFileInsight={isLoadingFileInsight}
              fileInsightError={fileInsightError}
              onRetryFileInsight={() => selectedFile?.path && fetchFileInsight(selectedFile.path)}
              overview={overview}
              isLoadingOverview={isLoadingOverview}
              overviewError={overviewError}
              onRetryOverview={fetchOverview}
              reportScores={reportScores}
              highComplexityFiles={highComplexityFiles}
              keyModules={overview?.keyModules || []}
              onFocusFile={(path) => {
                handleFileClick(path);
              }}
              onFocusRisk={(risk) => {
                const related = inferRiskFilesForAction(risk);
                handleHighlightFiles(related, `Risk: ${risk.title}`);
                setIsExplorerOpen(true);
              }}
              onFocusComplexity={() => {
                handleHighlightFiles(highComplexityFiles, 'Focused complexity hot spots');
                setIsExplorerOpen(true);
              }}
              inferRiskFiles={inferRiskFilesForAction}
              onClose={() => setIsInspectorOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
