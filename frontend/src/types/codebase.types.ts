export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  children?: FileNode[];
  language?: string;
}

export interface CodeMetricsSummary {
  totalLines: number;
  codeLines: number;
  blankLines: number;
  commentLines: number;
  mixedLines: number;
  provenance: 'measured' | 'estimated' | 'unavailable';
}

export interface RepoMetadata {
  name: string;
  totalFiles: number;
  totalSize: number;
  languages: Record<string, number>;
  fileTypes: Record<string, number>;
  depth: number;
  metrics?: CodeMetricsSummary;
  rawTotalFiles?: number;
  analyzedFiles?: number;
  isSampled?: boolean;
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
  branch?: string;
  commitSha?: string;
  contentHash?: string;
  rawManifestHash?: string;
}
