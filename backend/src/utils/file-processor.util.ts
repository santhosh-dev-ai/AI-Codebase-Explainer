import path from 'path';

export const BUNDLED_THIRD_PARTY_DIRS = new Set([
  'externals',
  'third_party',
  'third-party',
  '3rdparty',
  'vendored',
  'vendor',
]);

export function isBundledThirdPartyPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const segments = normalized.split('/');
  return (
    segments.some((seg) => BUNDLED_THIRD_PARTY_DIRS.has(seg)) ||
    /(^|\/)(externals?|third[-_]?party|3rdparty|vendored)(\/|$)/i.test(normalized)
  );
}

export function extractBundledPackageName(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i].toLowerCase();
    if (BUNDLED_THIRD_PARTY_DIRS.has(seg) || /(^|\/)(externals?|third[-_]?party|3rdparty|vendored)$/i.test(seg)) {
      const candidate = segments[i + 1];
      if (candidate && !candidate.startsWith('.')) {
        return candidate;
      }
    }
  }
  return undefined;
}

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
  'obj',
  '.idea',
  '.vscode',
]);

export const SAFE_CONFIG_FILES = new Set([
  '.gitignore',
  '.gitattributes',
  '.npmrc',
  '.nvmrc',
  '.editorconfig',
  '.dockerignore',
  '.browserslistrc',
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.defaults',
]);

export function isSafeConfigFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  if (SAFE_CONFIG_FILES.has(fileName)) {
    return true;
  }
  if (/^\.(eslintrc|prettierrc|babelrc|stylelintrc)(\.[a-z0-9_-]+)?$/i.test(fileName)) {
    return true;
  }
  return false;
}

export const SENSITIVE_SECRET_PATTERNS = [
  /^\.env(\.(local|production|prod|staging|stage|development|dev|test|test\.local))?$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /\.(pem|key|pkcs12|pfx|p12|kdbx|keystore)$/i,
  /(credential|secret|token|service[-_]?account|client[-_]?secret).*\.json$/i,
];

export function isSensitiveSecretFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  if (
    fileName === '.env.example' ||
    fileName === '.env.sample' ||
    fileName === '.env.template' ||
    fileName === '.env.defaults'
  ) {
    return false;
  }
  return SENSITIVE_SECRET_PATTERNS.some((pattern) => pattern.test(fileName));
}

export function redactSecretContent(filePath: string, content: string): string {
  if (!content) return content;

  let sanitized = content.replace(
    /-----BEGIN [A-Z0-9 -]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 -]+ PRIVATE KEY-----/g,
    '[REDACTED_PRIVATE_KEY]'
  );

  sanitized = sanitized.replace(
    /^(\s*[A-Za-z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD|PASSWD|AUTH|CREDENTIAL|PRIVATE)[A-Za-z0-9_]*\s*=\s*)(["']?)[^\r\n"']+(["']?)/gim,
    '$1$2[REDACTED_SECRET]$3'
  );

  sanitized = sanitized
    .replace(/\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g, '[REDACTED_AWS_KEY]')
    .replace(/\b(gsk_|sk-)[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_API_KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g, '[REDACTED_JWT]');

  return sanitized;
}

const EXCLUDED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
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

  // 1. Strict block on sensitive secret files
  if (isSensitiveSecretFile(filePath)) {
    return true;
  }

  // 2. Safe config files allowed even if starting with dot
  if (isSafeConfigFile(filePath)) {
    if (size && size > 500 * 1024) {
      return true;
    }
    return false;
  }

  // 3. Check excluded files
  if (EXCLUDED_FILES.has(fileName)) {
    return true;
  }

  // 4. Check excluded extensions
  if (EXCLUDED_EXTENSIONS.has(ext)) {
    return true;
  }

  // 5. Check file size (skip files > 500KB)
  if (size && size > 500 * 1024) {
    return true;
  }

  return false;
}

export function shouldExcludeDirectory(dirName: string): boolean {
  return EXCLUDED_DIRS.has(dirName);
}

export function detectLanguage(filePath: string): string {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName === '.gitignore' || fileName === '.gitattributes' || fileName === '.dockerignore') {
    return 'ignore';
  }
  if (fileName === '.editorconfig' || fileName === '.npmrc' || fileName === '.nvmrc') {
    return 'config';
  }
  if (fileName.startsWith('.env.')) {
    return 'dotenv';
  }
  if (fileName.startsWith('.eslintrc') || fileName.startsWith('.prettierrc') || fileName.startsWith('.babelrc')) {
    if (fileName.endsWith('.js') || fileName.endsWith('.cjs')) return 'javascript';
    if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) return 'yaml';
    return 'json';
  }

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
