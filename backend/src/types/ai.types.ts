export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: CodeContext;
  references?: FileReference[];
}

export interface CodeContext {
  currentFile?: string;
  relatedFiles?: string[];
  selectedCode?: string;
  lineRange?: { start: number; end: number };
}

export interface FileReference {
  path: string;
  lineStart?: number;
  lineEnd?: number;
  reason: string;
}

export interface StreamChunk {
  type: 'token' | 'reference' | 'done' | 'error';
  content?: string;
  reference?: FileReference;
  error?: string;
}
