'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileCode,
  FolderTree,
} from 'lucide-react';
import type { FileNode } from '@/types/codebase.types';
import { BranchedMenu, FolderFloat, LatticeLoader } from '@/components/react-bits';

interface ExplorerPaneProps {
  nodes: FileNode[];
  isLoading: boolean;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onFileClick: (path: string) => void;
  selectedPath: string | null;
  highlightedPaths: Set<string>;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export function ExplorerPane({
  nodes,
  isLoading,
  expandedFolders,
  onToggleFolder,
  onFileClick,
  selectedPath,
  highlightedPaths,
  onExpandAll,
  onCollapseAll,
}: ExplorerPaneProps) {
  return (
    <div className="flex flex-col h-full bg-void/90 border-r border-white/10 select-none overflow-hidden font-mono text-xs">
      {/* Explorer Pane Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-surface/50 flex-shrink-0">
        <div className="flex items-center gap-2 text-zinc-300 font-semibold tracking-wider uppercase text-[11px]">
          <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
          <span>Explorer</span>
        </div>

        {/* Quick controls */}
        <div className="flex items-center gap-1 text-zinc-500">
          {onExpandAll && (
            <button
              onClick={onExpandAll}
              className="p-1 hover:text-zinc-200 hover:bg-white/5 rounded text-[10px] transition-colors"
              title="Expand all folders"
            >
              Expand
            </button>
          )}
          {onCollapseAll && (
            <button
              onClick={onCollapseAll}
              className="p-1 hover:text-zinc-200 hover:bg-white/5 rounded text-[10px] transition-colors"
              title="Collapse all folders"
            >
              Collapse
            </button>
          )}
        </div>
      </div>

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto p-1.5 scroll-smooth">
        {isLoading ? (
          <div className="py-6 flex flex-col items-center justify-center">
            <LatticeLoader
              size="sm"
              label="Mapping File Tree"
              sublabel="Reading directory hierarchy & symbols"
            />
          </div>
        ) : nodes.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-zinc-500">
            No files match current filter.
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
    <div className="relative">
      {nodes.map((node, index) => (
        <FileTreeNode
          key={node.path}
          node={node}
          isLast={index === nodes.length - 1}
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
  isLast,
  expandedFolders,
  onToggleFolder,
  onFileClick,
  selectedPath,
  highlightedPaths,
  level,
}: {
  node: FileNode;
  isLast: boolean;
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
  const hasChildren = Boolean(isDirectory && node.children && node.children.length > 0);

  return (
    <div className="relative">
      {/* React Bits BranchedMenu tree connector lines */}
      {level > 0 && (
        <BranchedMenu
          depth={level}
          isLast={isLast}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          isActive={isSelected || isHighlighted}
        />
      )}

      <button
        type="button"
        onClick={() => {
          if (isDirectory) {
            onToggleFolder(node.path);
          } else {
            onFileClick(node.path);
          }
        }}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors group relative ${
          isSelected
            ? 'bg-cyan-500/15 text-cyan-200 font-medium border-l-2 border-cyan-400'
            : isHighlighted
            ? 'bg-cyan-400/10 text-cyan-300 border-l-2 border-cyan-300 font-medium'
            : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${level * 14 + 10}px` }}
      >
        {isDirectory ? (
          <FolderFloat
            isFolder={true}
            isOpen={isExpanded}
            itemCount={node.children?.length}
            className="flex items-center gap-1.5"
          >
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
            <span className="truncate">{node.name}</span>
          </FolderFloat>
        ) : (
          <FolderFloat isFolder={false} className="flex items-center gap-1.5 truncate">
            <span className="w-3.5 flex-shrink-0" />
            <FileCode className="w-3.5 h-3.5 flex-shrink-0 text-zinc-500 group-hover:text-cyan-300 transition-colors" />
            <span className="truncate">{node.name}</span>
          </FolderFloat>
        )}

        {isHighlighted && (
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ml-auto flex-shrink-0 animate-pulse" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isDirectory && isExpanded && node.children && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
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
