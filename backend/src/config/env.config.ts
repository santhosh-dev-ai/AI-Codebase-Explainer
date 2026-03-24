import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  aiApiKey: string;
  aiProvider: 'openai' | 'groq';
  githubToken?: string;
  redisUrl?: string;
  maxFileSize: number;
  sessionTTL: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  uploadsDir: string;
  sessionsDir: string;
  corsOrigin: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  aiProvider: (process.env.AI_PROVIDER as 'openai' | 'groq') || 'groq',
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
};

export function validateConfig(): void {
  if (!config.aiApiKey) {
    throw new Error(`${config.aiProvider.toUpperCase()}_API_KEY is required in environment variables`);
  }
}

export default config;
