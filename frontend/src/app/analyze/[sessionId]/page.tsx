'use client';

import { useState, useEffect, useCallback, useRef, useMemo, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/config';
import { prettyPrintLanguage } from '@/lib/utils';
import type { FileNode, RepoMetadata } from '@/types/codebase.types';
import type { ArchitectureOverview, AnalysisRisk, FileExplanation } from '@/types/analysis.types';
import {
  type FileTreeData,
  type FileContentData,
  type RightPanelTab,
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
import { CenterChatDock } from '@/components/workspace/CenterChatDock';
import { InsightsPane } from '@/components/workspace/InsightsPane';
import { X } from 'lucide-react';

interface AnalyzePageProps {
  params: { sessionId: string };
}

export default function AnalyzePage({ params }: AnalyzePageProps) {
  const router = useRouter();
  const { sessionId } = params;

  const mainLayoutRef = useRef<HTMLDivElement | null>(null);
  const centerPanelRef = useRef<HTMLElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Repository & File Tree State
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [metadata, setMetadata] = useState<RepoMetadata | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [error, setError] = useState('');

  // Overview & Architecture State
  const [overview, setOverview] = useState<ArchitectureOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState('');

  // Selected File State
  const [selectedFile, setSelectedFile] = useState<FileContentData | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // File AI Insights State
  const [fileInsight, setFileInsight] = useState<FileExplanation | null>(null);
  const [isLoadingFileInsight, setIsLoadingFileInsight] = useState(false);
  const [fileInsightError, setFileInsightError] = useState('');
  const fileInsightCache = useRef<Map<string, FileExplanation>>(new Map());

  // UI & Search State
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('overview');
  const [mobileTab, setMobileTab] = useState<MobileTab>('explorer');

  // Resizable Panes State
  const [leftPaneWidth, setLeftPaneWidth] = useState(280);
  const [rightPaneWidth, setRightPaneWidth] = useState(380);
  const [draggingPane, setDraggingPane] = useState<'left' | 'right' | null>(null);
  const [chatPanelHeight, setChatPanelHeight] = useState(175);
  const [isDraggingChatSlider, setIsDraggingChatSlider] = useState(false);

  // Highlighting State
  const [highlightedPaths, setHighlightedPaths] = useState<Set<string>>(new Set());
  const [highlightReason, setHighlightReason] = useState('');

  // Code Selection AI State
  const [isExplainingSelection, setIsExplainingSelection] = useState(false);
  const [selectionExplanation, setSelectionExplanation] = useState('');

  // Chat State
  const [chatMessages, setChatMessages] = useState<LocalChatMessage[]>([]);
  const [isLoadingChatHistory, setIsLoadingChatHistory] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [promptSeed] = useState(() => Date.now());

  // 1. Fetch File Content on Click
  const handleFileClick = useCallback(
    async (filePath: string) => {
      try {
        setIsLoadingFile(true);
        setSelectionExplanation('');

        const response = await apiClient.get<FileContentData>(API_ENDPOINTS.GET_FILE(sessionId), {
          filePath,
        });

        if (response.data) {
          setSelectedFile(response.data);
          // Switch to code tab on mobile when a file is clicked
          setMobileTab('code');
        }
      } catch (err) {
        console.error('Failed to load file:', err);
      } finally {
        setIsLoadingFile(false);
      }
    },
    [sessionId]
  );

  // Helper to find initial leaf file to preview
  const findInitialFile = useCallback((nodes: FileNode[]): string | null => {
    // Look for README first
    for (const node of nodes) {
      if (node.type === 'file' && /readme/i.test(node.name)) return node.path;
    }
    // Otherwise look for first file
    for (const node of nodes) {
      if (node.type === 'file') return node.path;
      if (node.children) {
        const found = findInitialFile(node.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // 2. Fetch File Tree
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

        // Auto-select initial file for immediate inspection
        const initial = findInitialFile(response.data.fileTree);
        if (initial) {
          handleFileClick(initial);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load file tree';
      if (/session not found|session expired/i.test(message)) {
        router.replace('/?error=session-expired');
        return;
      }
      setError(message);
    } finally {
      setIsLoadingTree(false);
    }
  }, [sessionId, router, findInitialFile, handleFileClick]);

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  // 3. Fetch File Insight
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
        setFileInsightError(err instanceof Error ? err.message : 'File insight is unavailable');
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

  // 4. Toggle Folder Expansion
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

  // 5. Fetch Architecture Overview
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

  // 6. Fetch Chat History
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

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isLoadingChatHistory]);

  // Pane Resizing Handlers
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
        const clamped = Math.max(140, Math.min(300, Math.round(desiredHeight)));
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
        tooltip: 'How cleanly modules are organized and decoupled.',
        value: overview.scorecard.architecture,
        colorFrom: '#06b6d4',
        colorTo: '#3b82f6',
      },
      {
        key: 'Maintainability',
        tooltip: 'How easily this repository can be refactored and maintained.',
        value: overview.scorecard.maintainability,
        colorFrom: '#10b981',
        colorTo: '#059669',
      },
      {
        key: 'Complexity',
        tooltip: 'Cognitive overhead and code density indicator.',
        value: overview.scorecard.complexity,
        colorFrom: '#f59e0b',
        colorTo: '#ef4444',
      },
      {
        key: 'Security',
        tooltip: 'Estimated security hardening and input validation score.',
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
      setMobileTab('explorer');
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

  // Chat message sending
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

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950 p-6">
        <div className="text-center max-w-md p-6 rounded-2xl border border-white/10 bg-zinc-900/60 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-rose-400" />
          </div>
          <h1 className="text-lg font-bold text-zinc-100 mb-2">Session Error</h1>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white rounded-lg font-medium text-xs transition-all"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  const dashboardData = {
    totalFiles: metadata?.totalFiles || 0,
    totalFolders,
    estimatedLoc,
    dominantLanguage,
    languageChart,
    filesPerFolderData,
    complexityData,
    folderTreemapData,
    riskBreakdown,
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* 1. Header */}
      <WorkspaceHeader
        sessionId={sessionId}
        metadata={metadata}
        selectedFilePath={selectedFile?.path}
        searchOpen={searchOpen}
        onToggleSearch={() => setSearchOpen((prev) => !prev)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        highlightedCount={highlightedPaths.size}
        highlightReason={highlightReason}
        onClearHighlights={clearHighlights}
        mobileActiveTab={mobileTab}
        onSelectMobileTab={setMobileTab}
      />

      {/* 2. Main Workspace Layout */}
      <div ref={mainLayoutRef} className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left Pane: Explorer */}
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
          />
        </div>

        {/* Resizer Handle: Left */}
        <div
          className={`hidden lg:block w-1 hover:w-1.5 bg-white/5 hover:bg-cyan-400/50 cursor-col-resize transition-all ${
            draggingPane === 'left' ? 'bg-cyan-400' : ''
          }`}
          onMouseDown={() => setDraggingPane('left')}
          title="Drag to resize explorer"
        />

        {/* Center Pane: Code Viewer & Chat Dock */}
        <main
          ref={centerPanelRef}
          className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative ${
            mobileTab === 'code' || mobileTab === 'chat'
              ? 'flex'
              : 'hidden lg:flex'
          }`}
        >
          {/* Code Viewer View (Shown when mobileTab is code, or always on desktop) */}
          <div
            className={`flex-1 flex min-h-0 min-w-0 ${
              mobileTab === 'chat' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <CodeViewerPane
              selectedFile={selectedFile}
              isLoadingFile={isLoadingFile}
              fileInsight={fileInsight}
              isLoadingFileInsight={isLoadingFileInsight}
              fileInsightError={fileInsightError}
              onRetryFileInsight={() => selectedFile?.path && fetchFileInsight(selectedFile.path)}
              onExplainSelection={explainSnippet}
              isExplainingSelection={isExplainingSelection}
              selectionExplanation={selectionExplanation}
              onDismissSelectionExplanation={() => setSelectionExplanation('')}
            />
          </div>

          {/* Center Chat Dock (Shown at bottom on desktop, or full screen when mobileTab === 'chat') */}
          <div
            className={
              mobileTab === 'chat'
                ? 'flex-1 flex flex-col min-h-0'
                : 'hidden lg:block'
            }
          >
            <CenterChatDock
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
          </div>
        </main>

        {/* Resizer Handle: Right */}
        <div
          className={`hidden lg:block w-1 hover:w-1.5 bg-white/5 hover:bg-cyan-400/50 cursor-col-resize transition-all ${
            draggingPane === 'right' ? 'bg-cyan-400' : ''
          }`}
          onMouseDown={() => setDraggingPane('right')}
          title="Drag to resize details"
        />

        {/* Right Pane: AI Insights & Tabs */}
        <div
          style={{ width: `${rightPaneWidth}px` }}
          className={`h-full flex-shrink-0 ${
            mobileTab === 'insights' ? 'flex w-full lg:w-auto' : 'hidden lg:flex'
          }`}
        >
          <InsightsPane
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            isLoading={isLoadingOverview}
            error={overviewError}
            onRetry={fetchOverview}
            overview={overview}
            reportScores={reportScores}
            highComplexityFiles={highComplexityFiles}
            architectureGraph={architectureGraph}
            dashboardData={dashboardData}
            inferRiskFilesForAction={inferRiskFilesForAction}
            onFocusComplexity={() =>
              handleHighlightFiles(highComplexityFiles, 'Focused high-complexity hot spots')
            }
            onFocusModule={(path) =>
              handleHighlightFiles([path], `Focused module: ${path.split('/').pop()}`)
            }
            onFocusFile={(path) =>
              handleHighlightFiles([path], `Focused file: ${path.split('/').pop()}`)
            }
            onFocusRisk={(risk) => {
              const related = inferRiskFilesForAction(risk);
              handleHighlightFiles(related, `Risk focus: ${risk.title}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
