import path from 'path';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '__pycache__',
  'venv',
  'env',
  '.venv',
  'vendor',
  'target',
  'bin',
  'obj',
  '.idea',
  '.vscode',
]);

const EXCLUDED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.gitignore',
  '.env',
  '.env.local',
  '.env.production',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.mp4',
  '.mp3',
  '.wav',
  '.avi',
  '.mov',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.pdf',
  '.min.js',
  '.min.css',
  '.map',
]);

export function shouldExcludeFile(filePath: string, size?: number): boolean {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Check excluded files
  if (EXCLUDED_FILES.has(fileName)) {
    return true;
  }

  // Check excluded extensions
  if (EXCLUDED_EXTENSIONS.has(ext)) {
    return true;
  }

  // Check file size (skip files > 500KB)
  if (size && size > 500 * 1024) {
    return true;
  }

  return false;
}

export function shouldExcludeDirectory(dirName: string): boolean {
  return EXCLUDED_DIRS.has(dirName);
}

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.r': 'r',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'bash',
    '.zsh': 'zsh',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
    '.xml': 'xml',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.md': 'markdown',
    '.txt': 'plaintext',
    '.vue': 'vue',
    '.svelte': 'svelte',
  };

  return languageMap[ext] || 'plaintext';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function calculateDepth(filePath: string): number {
  return filePath.split(path.sep).length - 1;
}
