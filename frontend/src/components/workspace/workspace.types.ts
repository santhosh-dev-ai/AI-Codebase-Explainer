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

export type RightPanelTab = 'overview' | 'architecture' | 'insights' | 'risks' | 'dashboard';

export type MobileTab = 'explorer' | 'code' | 'chat' | 'insights';

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
