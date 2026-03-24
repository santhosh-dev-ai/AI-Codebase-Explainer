'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/config';
import { formatBytes, getFileIcon, prettyPrintLanguage } from '@/lib/utils';
import type { FileNode, RepoMetadata } from '@/types/codebase.types';
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

  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [metadata, setMetadata] = useState<RepoMetadata | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(true);
  const [error, setError] = useState('');

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
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-surface/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="w-px h-6 bg-border" />
          <h1 className="text-sm font-semibold text-text-primary">
            {metadata?.name || 'Loading...'}
          </h1>
          {metadata && (
            <span className="text-xs text-text-secondary bg-background px-2 py-0.5 rounded-full">
              {metadata.totalFiles} files
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-hover rounded-md transition-colors"
            title="Search files"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Search bar */}
      {searchOpen && (
        <div className="px-4 py-2 border-b border-border bg-surface/30 animate-slide-in">
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
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - File Tree */}
        <aside className="w-72 border-r border-border bg-surface/30 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-border">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Explorer
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
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
        </aside>

        {/* Center - File Viewer */}
        <main className="flex-1 flex flex-col overflow-hidden">
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
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface/30">
                <div className="flex items-center gap-2">
                  <span className="text-base">{getFileIcon(selectedFile.path)}</span>
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
              <div className="flex-1 overflow-auto">
                <pre className="p-4 text-sm leading-relaxed">
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
              </div>
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
        </main>

        {/* Right Panel - Metadata */}
        {metadata && (
          <aside className="w-72 border-l border-border bg-surface/30 flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="p-4 border-b border-border">
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
            <div className="p-4 border-b border-border">
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
          </aside>
        )}
      </div>
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
      <button
        onClick={() => {
          if (isDirectory) {
            onToggleFolder(node.path);
          } else {
            onFileClick(node.path);
          }
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors group ${
          isSelected
            ? 'bg-accent/15 text-accent'
            : 'text-text-secondary hover:text-text-primary hover:bg-hover'
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
      </button>

      {isDirectory && isExpanded && node.children && (
        <FileTreeView
          nodes={node.children}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
          onFileClick={onFileClick}
          selectedPath={selectedPath}
          level={level + 1}
        />
      )}
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
