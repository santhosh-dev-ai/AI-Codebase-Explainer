export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  children?: FileNode[];
  language?: string;
}

export interface RepoMetadata {
  name: string;
  totalFiles: number;
  totalSize: number;
  languages: Record<string, number>;
  fileTypes: Record<string, number>;
  depth: number;
}

export interface FileContent {
  path: string;
  content: string;
  language: string;
  size: number;
  lines: number;
}

export interface SessionData {
  sessionId: string;
  fileTree: FileNode[];
  metadata: RepoMetadata;
  source: 'github' | 'zip';
  sourceUrl?: string;
}
