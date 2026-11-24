import type { FileNode, RepoMetadata } from '@/types/codebase.types';
import type { ChatMessage as AppChatMessage } from '@/types/chat.types';

export interface FileTreeData {
  fileTree: FileNode[];
  metadata: RepoMetadata;
}

export interface FileContentData {
  path: string;
  content: string;
  language: string;
  lines: number;
  size: number;
}

/** Primary Workspace View — only ONE active at a time */
export type WorkspaceMainView = 'code' | 'architecture' | 'overview' | 'risks' | 'metrics';

/** Contextual AI Inspector Tabs */
export type InspectorTab = 'explain' | 'architecture' | 'insights' | 'risks' | 'overview';

export type RightPanelTab = 'overview' | 'architecture' | 'insights' | 'risks' | 'dashboard' | 'explain';

export type MobileTab = 'explorer' | 'main' | 'inspector' | 'chat';

export type LocalChatMessage = Pick<AppChatMessage, 'id' | 'role' | 'content' | 'timestamp'>;

export interface SelectionExplainState {
  x: number;
  y: number;
  snippet: string;
  lineStart: number;
  lineEnd: number;
}

export interface ScoreItem {
  key: string;
  value: number;
  tooltip: string;
  colorFrom: string;
  colorTo: string;
}
