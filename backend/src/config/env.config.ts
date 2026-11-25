import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  aiApiKey: string;
  aiProvider: 'openai' | 'groq';
  groqModel: string;
  groqFastModel: string;
  openaiModel: string;
  githubToken?: string;
  redisUrl?: string;
  maxFileSize: number;
  sessionTTL: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  uploadsDir: string;
  sessionsDir: string;
  corsOrigin: string;
  sessionSecret: string;
  maxConcurrentIngestions: number;
  maxConcurrentAiRequests: number;
  maxExplanationCacheSize: number;
  maxOverviewCacheSize: number;
  maxDependencyGraphCacheSize: number;
  maxActiveSessions: number;
  maxChatHistoryPerSession: number;
  maxCanonicalDiskCacheBytes: number;
  canonicalDiskCacheTTL: number;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  aiProvider: (process.env.AI_PROVIDER as 'openai' | 'groq') || 'groq',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  groqFastModel: process.env.GROQ_FAST_MODEL || 'qwen/qwen3.8-27b',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  aiApiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '',
  githubToken: process.env.GITHUB_TOKEN,
  redisUrl: process.env.REDIS_URL,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
  sessionTTL: parseInt(process.env.SESSION_TTL || '3600', 10), // 1 hour
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  uploadsDir: path.join(__dirname, '../../uploads'),
  sessionsDir: path.join(__dirname, '../../sessions'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'codebase-explainer-secret-session-key-2026'),
  maxConcurrentIngestions: parseInt(process.env.MAX_CONCURRENT_INGESTIONS || '3', 10),
  maxConcurrentAiRequests: parseInt(process.env.MAX_CONCURRENT_AI_REQUESTS || '10', 10),
  maxExplanationCacheSize: parseInt(process.env.MAX_EXPLANATION_CACHE_SIZE || '300', 10),
  maxOverviewCacheSize: parseInt(process.env.MAX_OVERVIEW_CACHE_SIZE || '50', 10),
  maxDependencyGraphCacheSize: parseInt(process.env.MAX_DEP_GRAPH_CACHE_SIZE || '50', 10),
  maxActiveSessions: parseInt(process.env.MAX_ACTIVE_SESSIONS || '50', 10),
  maxChatHistoryPerSession: parseInt(process.env.MAX_CHAT_HISTORY_PER_SESSION || '50', 10),
  maxCanonicalDiskCacheBytes: parseInt(process.env.MAX_CANONICAL_DISK_CACHE_BYTES || '104857600', 10),
  canonicalDiskCacheTTL: parseInt(process.env.CANONICAL_DISK_CACHE_TTL || '604800', 10),
};

export function validateConfig(targetConfig: Config = config): void {
  if (!targetConfig.aiApiKey) {
    throw new Error(`${targetConfig.aiProvider.toUpperCase()}_API_KEY is required in environment variables`);
  }

  // Enforce strong SESSION_SECRET in production
  if (targetConfig.nodeEnv === 'production') {
    const secret = targetConfig.sessionSecret;
    if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
      throw new Error('SESSION_SECRET environment variable is required in production environment');
    }
    if (secret.trim().length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters long in production environment');
    }
    const insecureDefaults = [
      'codebase-explainer-secret-session-key-2026',
      'changeme',
      'secret',
      '12345678901234567890123456789012',
    ];
    if (insecureDefaults.includes(secret.trim())) {
      throw new Error('SESSION_SECRET cannot be a known default or insecure template in production environment');
    }
  }
}

export { config };
export default config;
