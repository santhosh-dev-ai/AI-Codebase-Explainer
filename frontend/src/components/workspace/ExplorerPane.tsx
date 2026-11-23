'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FolderTree,
} from 'lucide-react';
import type { FileNode } from '@/types/codebase.types';

interface ExplorerPaneProps {
  nodes: FileNode[];
  isLoading: boolean;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileClick: (path: string) => void;
  selectedPath: string | null;
  highlightedPaths: Set<string>;
  width?: number;
}

export function ExplorerPane({
  nodes,
  isLoading,
  expandedFolders,
  onToggleFolder,
  onFileClick,
  selectedPath,
  highlightedPaths,
}: ExplorerPaneProps) {
  return (
    <div className="flex flex-col h-full bg-zinc-950/70 border-r border-white/10 select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
          <span>Explorer</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 scroll-smooth momentum-scroll">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[...Array(6)].map((_, idx) => (
              <div
                key={idx}
                className="h-3.5 rounded bg-white/10 animate-pulse"
                style={{ width: `${60 + (idx % 4) * 12}%` }}
              />
            ))}
            <p className="text-xs text-zinc-400 pt-2 animate-pulse">Scanning file tree...</p>
          </div>
        ) : nodes.length === 0 ? (
          <div className="p-4 text-center text-xs text-zinc-500">
            No files match the search criteria.
          </div>
        ) : (
          <FileTreeView
            nodes={nodes}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
            onFileClick={onFileClick}
            selectedPath={selectedPath}
            highlightedPaths={highlightedPaths}
            level={0}
          />
        )}
      </div>
    </div>
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
      <button
        type="button"
        onClick={() => {
          if (isDirectory) {
            onToggleFolder(node.path);
          } else {
            onFileClick(node.path);
          }
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors group ${
          isSelected
            ? 'bg-cyan-500/20 text-cyan-100 font-medium border-l-2 border-cyan-400'
            : isHighlighted
            ? 'bg-cyan-400/15 text-cyan-200 border-l-2 border-cyan-300 font-medium'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${level * 14 + 6}px` }}
      >
        {isDirectory ? (
          <>
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500 group-hover:text-zinc-300" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500 group-hover:text-zinc-300" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400" />
            ) : (
              <Folder className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400/80" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5 flex-shrink-0" />
            <FileText className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400 group-hover:text-zinc-300" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>

      <AnimatePresence initial={false}>
        {isDirectory && isExpanded && node.children && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
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
