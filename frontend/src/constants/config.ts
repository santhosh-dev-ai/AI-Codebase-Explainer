export const API_BASE_URL = '';

export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  ANALYZE_GITHUB: '/api/repository/analyze-github',
  UPLOAD_ZIP: '/api/analyze',
  GET_FILE: (sessionId: string) => `/api/repository/${sessionId}/file`,
  GET_FILE_TREE: (sessionId: string) => `/api/repository/${sessionId}/tree`,
  GET_OVERVIEW: (sessionId: string) => `/api/analysis/${sessionId}/overview`,
  FILE_EXPLANATION: (sessionId: string) => `/api/analysis/${sessionId}/file-explanation`,
  BUG_DETECTION: (sessionId: string) => `/api/analysis/${sessionId}/bug-detection`,
  FLOW_DIAGRAM: (sessionId: string) => `/api/analysis/${sessionId}/flow-diagram`,
  CHAT_MESSAGE: (sessionId: string) => `/api/chat/${sessionId}/message`,
  CHAT_HISTORY: (sessionId: string) => `/api/chat/${sessionId}/history`,
} as const;

export const QUERY_KEYS = {
  FILE_TREE: 'fileTree',
  FILE_CONTENT: 'fileContent',
  OVERVIEW: 'overview',
  FILE_EXPLANATION: 'fileExplanation',
  BUGS: 'bugs',
  FLOW_DIAGRAM: 'flowDiagram',
  CHAT_HISTORY: 'chatHistory',
} as const;

export const LOCAL_STORAGE_KEYS = {
  SIDEBAR_WIDTH: 'codebase-explainer-sidebar-width',
  RIGHT_PANEL_WIDTH: 'codebase-explainer-right-panel-width',
  THEME: 'codebase-explainer-theme',
  RECENT_SESSIONS: 'codebase-explainer-recent-sessions',
} as const;
