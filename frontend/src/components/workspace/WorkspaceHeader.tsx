'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  X,
  FileCode2,
  FolderGit2,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Network,
  ShieldAlert,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import type { RepoMetadata } from '@/types/codebase.types';
import type { WorkspaceMainView, MobileTab } from './workspace.types';

interface WorkspaceHeaderProps {
  sessionId?: string;
  metadata: RepoMetadata | null;
  selectedFilePath?: string;
  activeView: WorkspaceMainView;
  onSelectView: (view: WorkspaceMainView) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  highlightedCount: number;
  highlightReason: string;
  onClearHighlights: () => void;
  isExplorerOpen: boolean;
  onToggleExplorer: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  mobileActiveTab: MobileTab;
  onSelectMobileTab: (tab: MobileTab) => void;
}

export function WorkspaceHeader({
  metadata,
  selectedFilePath,
  activeView,
  onSelectView,
  searchOpen,
  onToggleSearch,
  searchQuery,
  onSearchChange,
  highlightedCount,
  highlightReason,
  onClearHighlights,
  isExplorerOpen,
  onToggleExplorer,
  isInspectorOpen,
  onToggleInspector,
  isChatOpen,
  onToggleChat,
  mobileActiveTab,
  onSelectMobileTab,
}: WorkspaceHeaderProps) {
  const repoName = metadata?.name || 'Repository';
  const fileParts = selectedFilePath ? selectedFilePath.split('/') : [];

  return (
    <header className="flex-shrink-0 border-b border-white/10 bg-void/90 backdrop-blur-md z-30 select-none">
      <div className="flex items-center justify-between px-3 lg:px-4 py-2">
        {/* Left Section: Back, Explorer Toggle, Repo Badge & Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
            title="Return to Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Explorer Toggle Button (Desktop) */}
          <button
            onClick={onToggleExplorer}
            className={`hidden lg:flex p-1.5 rounded-lg transition-colors text-zinc-400 hover:text-zinc-100 hover:bg-white/5 ${
              !isExplorerOpen ? 'text-cyan-400 bg-white/5' : ''
            }`}
            title={isExplorerOpen ? 'Hide Explorer (Ctrl+B)' : 'Show Explorer (Ctrl+B)'}
          >
            {isExplorerOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>

          <div className="h-4 w-px bg-white/10 hidden sm:block" />

          {/* Repo Name Badge */}
          <div className="flex items-center gap-1.5 min-w-0 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-cyan-200 font-mono font-medium flex-shrink-0">
              <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="max-w-[130px] sm:max-w-[180px] truncate">{repoName}</span>
            </span>

            {/* Breadcrumb path for selected file */}
            {fileParts.length > 0 && activeView === 'code' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                <div className="hidden md:flex items-center gap-1 text-zinc-400 font-mono text-[11px] truncate">
                  {fileParts.slice(0, -1).map((segment, idx) => (
                    <React.Fragment key={idx}>
                      <span className="text-zinc-400 hover:text-zinc-200">{segment}</span>
                      <span className="text-zinc-600">/</span>
                    </React.Fragment>
                  ))}
                  <span className="text-zinc-100 font-semibold truncate">
                    {fileParts[fileParts.length - 1]}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Center Section: Primary Workspace View Switcher (Desktop) */}
        <div className="hidden lg:flex items-center gap-1 bg-void p-1 rounded-xl border border-white/10">
          <ViewTabButton
            active={activeView === 'code'}
            onClick={() => onSelectView('code')}
            icon={<FileCode2 className="w-3.5 h-3.5" />}
            label="Code"
          />
          <ViewTabButton
            active={activeView === 'architecture'}
            onClick={() => onSelectView('architecture')}
            icon={<Network className="w-3.5 h-3.5" />}
            label="Architecture"
          />
          <ViewTabButton
            active={activeView === 'overview'}
            onClick={() => onSelectView('overview')}
            icon={<Sparkles className="w-3.5 h-3.5" />}
            label="Overview"
          />
          <ViewTabButton
            active={activeView === 'risks'}
            onClick={() => onSelectView('risks')}
            icon={<ShieldAlert className="w-3.5 h-3.5" />}
            label="Risks"
          />
          <ViewTabButton
            active={activeView === 'metrics'}
            onClick={() => onSelectView('metrics')}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            label="Metrics"
          />
        </div>

        {/* Right Section: Focus Banner, Global Search & Panel Toggles */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Highlight / Focus indicator */}
          {highlightedCount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-[11px] font-mono text-cyan-200">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="max-w-[140px] truncate">
                {highlightReason || `${highlightedCount} focused`}
              </span>
              <button
                onClick={onClearHighlights}
                className="ml-1 text-cyan-400 hover:text-cyan-200 font-bold"
                title="Clear file focus"
              >
                ✕
              </button>
            </div>
          )}

          {/* Search Trigger */}
          <button
            onClick={onToggleSearch}
            className={`p-1.5 rounded-lg border transition-all text-xs flex items-center gap-1.5 ${
              searchOpen
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border-transparent'
            }`}
            title="Search files (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Toggle AI Chat Dock */}
          <button
            onClick={onToggleChat}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
              isChatOpen
                ? 'bg-violet-500/20 text-violet-200 border-violet-400/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border-white/10'
            }`}
            title="Toggle AI Chat Dock (Ctrl+K)"
          >
            <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
            <span className="hidden md:inline">AI Chat</span>
          </button>

          {/* Toggle Right AI Inspector */}
          <button
            onClick={onToggleInspector}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all ${
              isInspectorOpen
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border-white/10'
            }`}
            title="Toggle AI Inspector (Ctrl+I)"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xl:inline">AI Inspector</span>
            {isInspectorOpen ? (
              <PanelRightClose className="w-3.5 h-3.5 opacity-70" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5 opacity-70" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Search Input Bar */}
      {searchOpen && (
        <div className="px-3 lg:px-4 py-2 border-t border-white/5 bg-void/90 backdrop-blur-md">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search files by name or path..."
              className="w-full pl-9 pr-9 py-1.5 bg-surface border border-white/10 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400/50"
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

      {/* Mobile/Tablet Bottom Navigation Bar (< 1024px) */}
      <div className="lg:hidden flex items-center border-t border-white/10 bg-void px-2 py-1 gap-1">
        <MobileNavButton
          label="Explorer"
          icon={<FolderGit2 className="w-3.5 h-3.5" />}
          active={mobileActiveTab === 'explorer'}
          onClick={() => onSelectMobileTab('explorer')}
        />
        <MobileNavButton
          label="Main View"
          icon={<FileCode2 className="w-3.5 h-3.5" />}
          active={mobileActiveTab === 'main'}
          onClick={() => onSelectMobileTab('main')}
        />
        <MobileNavButton
          label="Inspector"
          icon={<Sparkles className="w-3.5 h-3.5" />}
          active={mobileActiveTab === 'inspector'}
          onClick={() => onSelectMobileTab('inspector')}
        />
        <MobileNavButton
          label="Chat"
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          active={mobileActiveTab === 'chat'}
          onClick={() => onSelectMobileTab('chat')}
        />
      </div>

      {/* Mobile Sub-View Switcher (when Main View is active on tablet/mobile) */}
      <div className="lg:hidden flex items-center border-t border-white/5 bg-surface/50 px-2 py-1 gap-1 overflow-x-auto scrollbar-hide">
        {(['code', 'architecture', 'overview', 'risks', 'metrics'] as WorkspaceMainView[]).map((view) => (
          <button
            key={view}
            onClick={() => onSelectView(view)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono capitalize transition-all whitespace-nowrap ${
              activeView === view
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {view}
          </button>
        ))}
      </div>
    </header>
  );
}

function ViewTabButton({
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
      className={`cursor-target flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all ${
        active
          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-medium shadow-[0_0_10px_rgba(34,211,238,0.15)]'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
      }`}
      data-cursor-label={label}
    >
      {icon}
      <span>{label}</span>
    </button>
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
      className={`cursor-target flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-mono transition-all ${
        active
          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-medium'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
      }`}
      data-cursor-label={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
