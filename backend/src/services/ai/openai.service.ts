import { openai, MODELS, AI_CONFIG } from '../../config/openai.config';
import logger from '../../utils/logger.util';
import { Stream } from 'openai/streaming';

export class OpenAIService {
  async generateCompletion(
    prompt: string,
    systemPrompt?: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const primaryModel = options?.model || MODELS.GPT4_TURBO;
    const fallbackModel = MODELS.GPT35_TURBO;
    const maxRetries = AI_CONFIG.retryAttempts || 3;
    let attempt = 0;
    let currentModel = primaryModel;
    let hasFallenBack = false;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const response = await openai.chat.completions.create({
          model: currentModel,
          messages: [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            { role: 'user' as const, content: prompt },
          ],
          temperature: options?.temperature ?? AI_CONFIG.temperature,
          max_tokens: options?.maxTokens ?? AI_CONFIG.maxTokens,
        });

        const choice = response.choices[0];
        const message = choice?.message;
        let content = message?.content || '';

        // If content is empty but model produced reasoning, use reasoning or content
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
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isModelNotFoundError =
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

        // If we still have retries left on a transient error (rate limit, connection, 503)
        const isTransient =
          errorMsg.includes('rate_limit') ||
          errorMsg.includes('429') ||
          errorMsg.includes('503') ||
          errorMsg.includes('Connection error') ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('ECONNRESET');

        if (isTransient && attempt < maxRetries) {
          const delay = (AI_CONFIG.retryDelay || 1000) * Math.pow(2, attempt - 1);
          logger.warn(`AI request failed on attempt ${attempt}, retrying in ${delay}ms...`, {
            model: currentModel,
            error: errorMsg,
          });
          await new Promise((res) => setTimeout(res, delay));
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
    }
  ): Promise<Stream<any>> {
    try {
      const stream = await openai.chat.completions.create({
        model: options?.model || MODELS.GPT4_TURBO,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        temperature: options?.temperature ?? AI_CONFIG.temperature,
        max_tokens: options?.maxTokens ?? AI_CONFIG.maxTokens,
        stream: true,
      });

      logger.info('OpenAI streaming started', {
        model: options?.model || MODELS.GPT4_TURBO,
        promptLength: prompt.length
      });

      return stream;
    } catch (error) {
      logger.error('OpenAI streaming error', { error: error instanceof Error ? error.message : 'Unknown error'
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

  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) {
      return text;
    }

    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(text.length * ratio);
    return text.substring(0, targetLength) + '...';
  }
}

export const openaiService = new OpenAIService();
