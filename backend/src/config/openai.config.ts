import OpenAI from 'openai';
import config from './env.config';

// Configure AI client based on provider
// Set maxRetries to 0 to prevent nested SDK retries and allow centralized application-level retry handling
export const openai = new OpenAI({
  apiKey: config.aiApiKey,
  baseURL: config.aiProvider === 'groq'
    ? 'https://api.groq.com/openai/v1'
    : 'https://api.openai.com/v1',
  timeout: 60000,
  maxRetries: 0,
});

// Model configuration based on provider
export const MODELS = config.aiProvider === 'groq'
  ? {
      GPT4_TURBO: config.groqModel || 'openai/gpt-oss-120b',
      GPT35_TURBO: config.groqFastModel || 'qwen/qwen3.8-27b',
      EMBEDDING: 'text-embedding-3-small', // Groq doesn't have embeddings yet
    }
  : {
      GPT4_TURBO: config.openaiModel || 'gpt-4-turbo-preview',
      GPT35_TURBO: process.env.OPENAI_FAST_MODEL || 'gpt-3.5-turbo',
      EMBEDDING: 'text-embedding-3-small',
    };

export const TOKEN_LIMITS = {
  GPT4_TURBO: 128000,
  GPT35_TURBO: 16385,
  SAFE_CONTEXT: 8000, // Conservative limit for context
} as const;

export const COST_PER_1K_TOKENS = {
  GPT4_TURBO_INPUT: 0.01,
  GPT4_TURBO_OUTPUT: 0.03,
  GPT35_TURBO_INPUT: 0.0005,
  GPT35_TURBO_OUTPUT: 0.0015,
  EMBEDDING: 0.0001,
} as const;

export const AI_CONFIG = {
  temperature: 0.7,
  maxTokens: 2000,
  streamingChunkSize: 50,
  retryAttempts: 3,
  retryDelay: 1000,
  maxRetryWaitMs: 15000,
  totalRetryDeadlineMs: 30000,
} as const;
