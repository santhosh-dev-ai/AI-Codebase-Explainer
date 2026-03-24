export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: unknown;
  };
}

export interface AnalyzeGitHubRequest {
  githubUrl: string;
  branch?: string;
}

export interface AnalyzeGitHubResponse {
  sessionId: string;
  fileTree: import('./codebase.types').FileNode[];
  metadata: import('./codebase.types').RepoMetadata;
}

export interface GetFileResponse {
  path: string;
  content: string;
  language: string;
  lines: number;
  size: number;
}
