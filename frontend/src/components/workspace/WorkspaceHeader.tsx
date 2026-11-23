'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  X,
  FileCode,
  FolderGit2,
  Sparkles,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import type { RepoMetadata } from '@/types/codebase.types';
import type { MobileTab } from './workspace.types';

interface WorkspaceHeaderProps {
  sessionId?: string;
  metadata: RepoMetadata | null;
  selectedFilePath?: string;
  searchOpen: boolean;
  onToggleSearch: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  highlightedCount: number;
  highlightReason: string;
  onClearHighlights: () => void;
  mobileActiveTab: MobileTab;
  onSelectMobileTab: (tab: MobileTab) => void;
}

export function WorkspaceHeader({
  metadata,
  selectedFilePath,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  highlightedCount,
  highlightReason,
  onClearHighlights,
  mobileActiveTab,
  onSelectMobileTab,
}: WorkspaceHeaderProps) {
  const repoName = metadata?.name || 'Repository';
  const fileParts = selectedFilePath ? selectedFilePath.split('/') : [];

  return (
    <header className="flex-shrink-0 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md z-30">
      <div className="flex items-center justify-between px-3 lg:px-4 py-2.5">
        {/* Left: Back button & Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
            title="Back to home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-1.5 min-w-0 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-cyan-200 font-sans font-medium flex-shrink-0">
              <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="max-w-[140px] md:max-w-[200px] truncate">{repoName}</span>
            </span>

            {fileParts.length > 0 && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                <div className="hidden sm:flex items-center gap-1 text-zinc-400 truncate">
                  {fileParts.slice(0, -1).map((segment, idx) => (
                    <React.Fragment key={idx}>
                      <span className="hover:text-zinc-200">{segment}</span>
                      <span className="text-zinc-600">/</span>
                    </React.Fragment>
                  ))}
                </div>
                <span className="text-zinc-100 font-semibold truncate">
                  {fileParts[fileParts.length - 1]}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Highlights banner, Search, & Mobile Nav */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {highlightedCount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-[11px] text-cyan-200">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{highlightReason || `${highlightedCount} focused`}</span>
              <button
                onClick={onClearHighlights}
                className="ml-1 text-cyan-400 hover:text-cyan-200 font-bold"
                title="Clear highlights"
              >
                ✕
              </button>
            </div>
          )}

          {metadata && (
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-white/5 border border-white/10 text-zinc-400">
              {metadata.totalFiles} files
            </span>
          )}

          <button
            onClick={onToggleSearch}
            className={`p-1.5 rounded-lg border transition-colors ${
              searchOpen
                ? 'bg-cyan-400/20 text-cyan-200 border-cyan-400/40'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border-transparent'
            }`}
            title="Search files"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input Bar (collapsible) */}
      {searchOpen && (
        <div className="px-3 lg:px-4 py-2 border-t border-white/5 bg-zinc-900/60 backdrop-blur-md">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter files by name or path..."
              className="w-full pl-9 pr-9 py-1.5 bg-zinc-950/80 border border-white/10 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400/50"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile/Tablet Bottom Tab Switcher (Visible on < 1024px) */}
      <div className="lg:hidden flex items-center border-t border-white/10 bg-zinc-950 px-2 py-1 gap-1">
        <MobileNavButton
          label="Explorer"
          icon={<FolderGit2 className="w-3.5 h-3.5" />}
          active={mobileActiveTab === 'explorer'}
          onClick={() => onSelectMobileTab('explorer')}
        />
        <MobileNavButton
          label="Code"
          icon={<FileCode className="w-3.5 h-3.5" />}
          active={mobileActiveTab === 'code'}
          onClick={() => onSelectMobileTab('code')}
        />
        <MobileNavButton
          label="Chat"
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          active={mobileActiveTab === 'chat'}
          onClick={() => onSelectMobileTab('chat')}
        />
        <MobileNavButton
          label="Insights"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          active={mobileActiveTab === 'insights'}
          onClick={() => onSelectMobileTab('insights')}
        />
      </div>
    </header>
  );
}

function MobileNavButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors ${
        active
          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
