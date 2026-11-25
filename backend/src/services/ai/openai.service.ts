import { openai, MODELS, AI_CONFIG } from '../../config/openai.config';
import logger from '../../utils/logger.util';
import { Stream } from 'openai/streaming';

export class OpenAIService {
  /**
   * Parse provider Retry-After and rate-limit reset headers.
   * Supports integer/float seconds, HTTP-date format, and Groq x-ratelimit-reset headers.
   */
  public parseRetryAfter(error: any): number | null {
    if (!error) return null;

    const headers = error.headers || error.response?.headers;
    let headerValue: string | undefined;

    if (headers) {
      if (typeof headers.get === 'function') {
        headerValue = headers.get('retry-after') ?? headers.get('Retry-After') ?? undefined;
      } else {
        headerValue = headers['retry-after'] ?? headers['Retry-After'];
      }
    }

    const numericPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

    if (headerValue !== undefined && headerValue !== null) {
      const trimmed = String(headerValue).trim();

      if (trimmed.length > 0) {
        // 1. Distinguish numeric values BEFORE Date parsing so negative numbers (e.g. "-5")
        // are rejected cleanly rather than parsed as 1969/1970 dates.
        if (numericPattern.test(trimmed)) {
          const seconds = Number(trimmed);
          if (isFinite(seconds) && seconds >= 0 && !trimmed.startsWith('-')) {
            const ms = Math.round(seconds * 1000);
            if (isFinite(ms)) return ms;
          }
        } else {
          // 2. HTTP-Date: e.g. "Wed, 21 Oct 2026 07:28:00 GMT"
          const parsedDate = new Date(trimmed);
          if (!isNaN(parsedDate.getTime())) {
            const diffMs = parsedDate.getTime() - Date.now();
            return Math.max(0, diffMs);
          }
        }
      }
    }

    // 3. Provider-specific reset headers: x-ratelimit-reset-requests, x-ratelimit-reset-tokens
    if (headers) {
      const resetVal =
        typeof headers.get === 'function'
          ? headers.get('x-ratelimit-reset-requests') ?? headers.get('x-ratelimit-reset-tokens')
          : headers['x-ratelimit-reset-requests'] ?? headers['x-ratelimit-reset-tokens'];

      if (resetVal !== undefined && resetVal !== null && typeof resetVal === 'string') {
        const trimmedReset = resetVal.trim();
        let unitMultiplier = 1000;
        let numPart = trimmedReset;

        if (trimmedReset.endsWith('ms')) {
          unitMultiplier = 1;
          numPart = trimmedReset.slice(0, -2).trim();
        } else if (trimmedReset.endsWith('s')) {
          unitMultiplier = 1000;
          numPart = trimmedReset.slice(0, -1).trim();
        }

        if (numericPattern.test(numPart)) {
          const parsedNum = Number(numPart);
          if (isFinite(parsedNum) && parsedNum >= 0 && !numPart.startsWith('-')) {
            const ms = Math.round(parsedNum * unitMultiplier);
            if (isFinite(ms)) return ms;
          }
        }
      }
    }

    return null;
  }

  private sanitizeErrorMessage(msg: string): string {
    return msg
      .replace(/\b(gsk_|sk-|ghp_|github_pat_)[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_KEY]')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
  }

  async generateCompletion(
    prompt: string,
    systemPrompt?: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      responseFormat?: { type: 'json_object' | 'text' };
      reasoningEffort?: 'low' | 'medium' | 'high';
    }
  ): Promise<string> {
    const primaryModel = options?.model || MODELS.GPT4_TURBO;
    const fallbackModel = MODELS.GPT35_TURBO;
    const maxRetries = AI_CONFIG.retryAttempts || 3;
    const startTime = Date.now();
    let attempt = 0;
    let currentModel = primaryModel;
    let hasFallenBack = false;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const requestPayload: Record<string, any> = {
          model: currentModel,
          messages: [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            { role: 'user' as const, content: prompt },
          ],
          temperature: options?.temperature ?? AI_CONFIG.temperature,
          max_tokens: options?.maxTokens ?? AI_CONFIG.maxTokens,
        };

        if (options?.responseFormat) {
          requestPayload.response_format = options.responseFormat;
        }
        if (options?.reasoningEffort && currentModel.includes('gpt-oss')) {
          requestPayload.reasoning_effort = options.reasoningEffort;
        }

        const response = await openai.chat.completions.create(requestPayload as any);

        const choice = response.choices[0];
        const message = choice?.message;
        let content = message?.content || '';

        // If structured JSON was requested and content is empty, fail explicitly instead of
        // masquerading raw reasoning prose as JSON or truncated output.
        if (!content.trim() && options?.responseFormat?.type === 'json_object') {
          throw new Error(
            `AI returned empty structured JSON content (finish_reason=${choice?.finish_reason || 'unknown'})`
          );
        }

        // If content is empty for unstructured completions, fall back to reasoning if present
        if (!content.trim() && typeof (message as any)?.reasoning === 'string') {
          content = (message as any).reasoning;
        }

        logger.info('AI completion generated', {
          model: currentModel,
          promptLength: prompt.length,
          responseLength: content.length,
          usage: response.usage,
          attempt,
        });

        return content;
      } catch (error: any) {
        const rawErrorMsg = error instanceof Error ? error.message : String(error);
        const errorMsg = this.sanitizeErrorMessage(rawErrorMsg);
        const status =
          error?.status ||
          error?.response?.status ||
          (errorMsg.includes('429')
            ? 429
            : errorMsg.includes('413')
            ? 413
            : errorMsg.includes('401')
            ? 401
            : errorMsg.includes('400')
            ? 400
            : errorMsg.includes('403')
            ? 403
            : errorMsg.includes('422')
            ? 422
            : 0);

        // 1. Permanent Failures: NEVER retry 401, 400, 403, 422
        const isAuthError =
          status === 401 ||
          errorMsg.includes('invalid_api_key') ||
          errorMsg.includes('Incorrect API key') ||
          errorMsg.includes('Authentication');
        if (isAuthError) {
          logger.error('Invalid AI API credentials, bypassing retries', {
            model: currentModel,
            error: errorMsg,
          });
          throw new Error(`AI Provider Authentication Failed: ${errorMsg}`);
        }

        const isBadRequest =
          status === 400 ||
          status === 403 ||
          status === 422 ||
          errorMsg.includes('invalid_request_error') ||
          errorMsg.includes('unsupported_parameter');
        if (isBadRequest) {
          logger.error('Invalid AI request parameter or format, bypassing retries', {
            model: currentModel,
            error: errorMsg,
          });
          throw new Error(`AI Invalid Request: ${errorMsg}`);
        }

        // 2. Context / Payload size limit error (HTTP 413 / context length):
        // Never misclassify HTTP 429 rate-limit errors (e.g., Groq TPM/OTPM limits) as HTTP 413.
        const providerCode = String(error?.code || error?.error?.code || '').toLowerCase();
        const isRateLimitError =
          status === 429 ||
          providerCode === 'rate_limit_exceeded' ||
          errorMsg.toLowerCase().includes('rate limit');

        const isTokenLimitError =
          !isRateLimitError &&
          (status === 413 ||
            providerCode === 'context_length_exceeded' ||
            errorMsg.includes('Request too large') ||
            errorMsg.includes('maximum context length'));

        if (isTokenLimitError && !hasFallenBack && currentModel !== fallbackModel) {
          logger.warn(`Context/payload limit exceeded on ${currentModel}, falling back to ${fallbackModel}`, {
            status,
            error: errorMsg,
          });
          currentModel = fallbackModel;
          hasFallenBack = true;
          continue;
        } else if (isTokenLimitError) {
          logger.warn('Token limit exceeded across models, falling back to deterministic analysis', {
            status,
            error: errorMsg,
          });
          throw new Error(`AI Token Limit Exceeded: ${errorMsg}`);
        }

        const isModelNotFoundError =
          status === 404 ||
          errorMsg.includes('404') ||
          errorMsg.includes('does not exist') ||
          errorMsg.includes('model_not_found') ||
          errorMsg.includes('decommissioned');

        // If the primary model failed because it's not found/decommissioned, fallback once
        if (isModelNotFoundError && !hasFallenBack && currentModel !== fallbackModel) {
          logger.warn(`Model ${currentModel} not available, falling back to ${fallbackModel}`, {
            error: errorMsg,
          });
          currentModel = fallbackModel;
          hasFallenBack = true;
          continue;
        }

        // 3. Transient errors: 429, 500, 502, 503, 504, connection errors
        const isTransient =
          isRateLimitError ||
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          errorMsg.includes('rate_limit') ||
          errorMsg.includes('429') ||
          errorMsg.includes('503') ||
          errorMsg.includes('Connection error') ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('ECONNRESET') ||
          errorMsg.includes('ETIMEDOUT') ||
          errorMsg.includes('socket hang up');

        if (isTransient && attempt < maxRetries) {
          const retryAfterMs = this.parseRetryAfter(error);
          const baseDelay = AI_CONFIG.retryDelay || 1000;
          const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * 200);
          let waitMs = exponentialDelay + jitter;

          if (retryAfterMs !== null) {
            // Never retry earlier than provider requested delay
            waitMs = Math.max(waitMs, retryAfterMs);
          }

          // Bound wait time to ceiling
          if (waitMs > AI_CONFIG.maxRetryWaitMs) {
            logger.warn('Retry delay exceeds maximum wait ceiling, aborting retries', {
              waitMs,
              maxRetryWaitMs: AI_CONFIG.maxRetryWaitMs,
            });
            throw this.handleOpenAIError(error);
          }

          // Bound to overall request deadline
          if (Date.now() - startTime + waitMs > AI_CONFIG.totalRetryDeadlineMs) {
            logger.warn('Total retry deadline exceeded, aborting retries', {
              elapsed: Date.now() - startTime,
              deadline: AI_CONFIG.totalRetryDeadlineMs,
            });
            throw this.handleOpenAIError(error);
          }

          logger.warn(`Transient AI failure on attempt ${attempt}/${maxRetries}, retrying in ${waitMs}ms...`, {
            model: currentModel,
            status,
            retryAfterMs,
            waitMs,
            error: errorMsg,
          });

          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }

        logger.error('AI completion error', {
          model: currentModel,
          attempt,
          error: errorMsg,
        });
        throw this.handleOpenAIError(error);
      }
    }

    throw new Error('Failed to generate AI completion after maximum retry attempts');
  }

  async generateStreamingCompletion(
    prompt: string,
    systemPrompt?: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      abortSignal?: AbortSignal;
    }
  ): Promise<Stream<any>> {
    const primaryModel = options?.model || MODELS.GPT4_TURBO;
    const fallbackModel = MODELS.GPT35_TURBO;

    try {
      const stream = await openai.chat.completions.create(
        {
          model: primaryModel,
          messages: [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            { role: 'user' as const, content: prompt },
          ],
          temperature: options?.temperature ?? AI_CONFIG.temperature,
          max_tokens: options?.maxTokens ?? AI_CONFIG.maxTokens,
          stream: true,
        },
        {
          signal: options?.abortSignal,
        }
      );

      logger.info('OpenAI streaming started', {
        model: primaryModel,
        promptLength: prompt.length,
      });

      return stream;
    } catch (error: any) {
      if (options?.abortSignal?.aborted || error?.name === 'AbortError' || error?.name === 'APIUserAbortError') {
        logger.info('Streaming aborted via AbortSignal before initialization', { model: primaryModel });
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      const isModelOrContextError =
        errorMsg.includes('404') ||
        errorMsg.includes('does not exist') ||
        errorMsg.includes('model_not_found') ||
        errorMsg.includes('decommissioned') ||
        errorMsg.includes('maximum context length');

      if (isModelOrContextError && primaryModel !== fallbackModel) {
        logger.warn(`Streaming failed on ${primaryModel}, falling back to ${fallbackModel}`, {
          error: errorMsg,
        });

        try {
          const fallbackStream = await openai.chat.completions.create(
            {
              model: fallbackModel,
              messages: [
                ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
                { role: 'user' as const, content: prompt },
              ],
              temperature: options?.temperature ?? AI_CONFIG.temperature,
              max_tokens: options?.maxTokens ?? AI_CONFIG.maxTokens,
              stream: true,
            },
            {
              signal: options?.abortSignal,
            }
          );

          logger.info('OpenAI fallback streaming started', {
            model: fallbackModel,
            promptLength: prompt.length,
          });

          return fallbackStream;
        } catch (fallbackError) {
          logger.error('Fallback streaming error', {
            model: fallbackModel,
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
          throw this.handleOpenAIError(fallbackError);
        }
      }

      logger.error('OpenAI streaming error', {
        model: primaryModel,
        error: errorMsg,
      });
      throw this.handleOpenAIError(error);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: MODELS.EMBEDDING,
        input: text,
      });

      const embedding = response.data[0]?.embedding || [];
      logger.debug('Embedding generated', {
        textLength: text.length,
        embeddingDim: embedding.length
      });

      return embedding;
    } catch (error) {
      logger.error('OpenAI embedding error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw this.handleOpenAIError(error);
    }
  }

  private handleOpenAIError(error: unknown): Error {
    if (error instanceof Error) {
      const sanitized = error.message.replace(/(?:gsk_|sk-)[a-zA-Z0-9_-]+/g, '[REDACTED_API_KEY]');

      if (sanitized.includes('rate_limit') || sanitized.includes('429')) {
        return new Error('AI provider rate limit reached. Please retry in a few moments.');
      }
      if (sanitized.includes('insufficient_quota') || sanitized.includes('quota')) {
        return new Error('AI provider quota exceeded. Please check your API credits.');
      }
      if (sanitized.includes('invalid_api_key') || sanitized.includes('401')) {
        return new Error('Invalid AI API key. Please check your configuration.');
      }
      if (sanitized.includes('404') || sanitized.includes('does not exist') || sanitized.includes('model_not_found')) {
        return new Error('Configured AI model is unavailable. Falling back to alternative model.');
      }
      if (sanitized.includes('Connection error') || sanitized.includes('ECONNREFUSED') || sanitized.includes('ETIMEDOUT')) {
        return new Error('Unable to connect to AI provider. Please check your internet connection.');
      }
      return new Error(`AI error: ${sanitized}`);
    }
    return new Error('Unknown AI error');
  }

  /**
   * Code-aware token estimation.
   * Standard English prose averages ~4 characters per token.
   * Source code (TypeScript, JavaScript, Python, JSON) contains heavy indentation,
   * camelCase identifiers, punctuation symbols ({}, [], (), ;, =>), and short operators,
   * which tokenizes at approximately 2.8 to 3.4 characters per token.
   * This implementation calculates a code-aware token estimate with a conservative safety margin.
   */
  estimateTokens(text: string): number {
    if (!text) return 0;

    // 1. Code syntax symbols: braces, parens, brackets, operators, delimiters
    const punctuationMatches = text.match(/[{}[\]()<>=:;,.\-+*\/&|^~!%]/g);
    const punctuationCount = punctuationMatches ? punctuationMatches.length : 0;

    // 2. CamelCase word transitions: e.g. "myFunctionName" splits into multiple tokens
    const camelMatches = text.match(/[a-z][A-Z]/g);
    const camelCount = camelMatches ? camelMatches.length : 0;

    // 3. Indentation & newline structure
    const indentMatches = text.match(/\n[ \t]+/g);
    const indentCount = indentMatches ? indentMatches.length : 0;

    // Base tokens (~4 chars per token for plain words) + code syntax tokens
    const baseTokens = text.length / 4;
    const codeBonus = punctuationCount * 0.35 + camelCount * 0.5 + indentCount * 0.4;

    // Apply conservative 10% safety margin for context budget protection
    const estimated = Math.ceil((baseTokens + codeBonus) * 1.1);
    return Math.max(1, estimated);
  }

  truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) {
      return text;
    }

    const ratio = maxTokens / estimatedTokens;
    let targetLength = Math.floor(text.length * ratio);

    // Snap to line boundary so we don't chop code mid-identifier or mid-line
    const lastNewline = text.lastIndexOf('\n', targetLength);
    if (lastNewline > targetLength * 0.8) {
      targetLength = lastNewline;
    }

    return text.substring(0, targetLength) + '\n// ... [truncated for context limit]';
  }
}

export const openaiService = new OpenAIService();
