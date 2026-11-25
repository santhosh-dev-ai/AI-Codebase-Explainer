import winston from 'winston';
import config from '../config/env.config';

const SECRET_PATTERNS = [
  // Private keys
  { regex: /-----BEGIN [A-Z0-9 -]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 -]+ PRIVATE KEY-----/g, repl: '[REDACTED_PRIVATE_KEY]' },
  // GitHub tokens
  { regex: /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/g, repl: '[REDACTED_GITHUB_TOKEN]' },
  // AWS Keys
  { regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g, repl: '[REDACTED_AWS_KEY]' },
  // OpenAI & Groq keys
  { regex: /\b(gsk_|sk-)[A-Za-z0-9_-]{20,}\b/g, repl: '[REDACTED_API_KEY]' },
  // JWT tokens
  { regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g, repl: '[REDACTED_JWT]' },
  // Key assignments in messages
  { regex: /(\b(?:password|passwd|secret|token|api[_-]?key|auth)\s*[:=]\s*["']?)[^\s"',;]{6,}(["']?)/gi, repl: '$1[REDACTED_SECRET]$2' },
];

export function redactString(str: string): string {
  if (typeof str !== 'string' || !str) return str;
  let result = str;
  for (const { regex, repl } of SECRET_PATTERNS) {
    result = result.replace(regex, repl);
  }
  return result;
}

export function redactObject<T>(obj: T, visited = new WeakSet()): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return redactString(obj) as any;
  }
  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle Error instances without mutating original
  if (obj instanceof Error) {
    const clonedErr: any = new Error(redactString(obj.message));
    clonedErr.name = obj.name;
    if (obj.stack) {
      clonedErr.stack = redactString(obj.stack);
    }
    for (const key of Object.keys(obj)) {
      if (key !== 'name' && key !== 'message' && key !== 'stack') {
        clonedErr[key] = redactObject((obj as any)[key], visited);
      }
    }
    return clonedErr;
  }

  if (visited.has(obj as any)) {
    return obj;
  }
  visited.add(obj as any);

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, visited)) as any;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (/^(password|passwd|secret|token|apiKey|authorization|privateKey)$/i.test(key) && typeof value === 'string') {
      result[key] = '[REDACTED_SECRET]';
    } else {
      result[key] = redactObject(value, visited);
    }
  }
  return result;
}

export const secretRedactionFormat = winston.format((info) => {
  return redactObject(info);
})();

const logFormat = winston.format.combine(
  secretRedactionFormat,
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'codebase-explainer-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (config.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        secretRedactionFormat,
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export default logger;
