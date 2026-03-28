interface Config {
  nodeEnv: string;
  aiApiKey: string;
  aiProvider: 'openai' | 'groq';
  githubToken?: string;
  maxFileSize: number;
  sessionTTL: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',

  aiProvider: (process.env.AI_PROVIDER as 'openai' | 'groq') || 'groq',

  aiApiKey:
    process.env.GROQ_API_KEY ||
    process.env.OPENAI_API_KEY ||
    '',

  githubToken: process.env.GITHUB_TOKEN,

  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),

  sessionTTL: parseInt(process.env.SESSION_TTL || '3600', 10),

  rateLimitWindowMs: parseInt(
    process.env.RATE_LIMIT_WINDOW_MS || '60000',
    10
  ),

  rateLimitMaxRequests: parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || '100',
    10
  ),
};

export function validateConfig(): void {
  if (!config.aiApiKey) {
    throw new Error(
      `${config.aiProvider.toUpperCase()}_API_KEY is required`
    );
  }
}

export default config;