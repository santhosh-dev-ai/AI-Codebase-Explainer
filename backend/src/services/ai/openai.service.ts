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
    try {
      const response = await openai.chat.completions.create({
        model: options?.model || MODELS.GPT4_TURBO,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        temperature: options?.temperature ?? AI_CONFIG.temperature,
        max_tokens: options?.maxTokens ?? AI_CONFIG.maxTokens,
      });

      const content = response.choices[0]?.message?.content || '';
      logger.info('OpenAI completion generated', {
        model: options?.model || MODELS.GPT4_TURBO,
        promptLength: prompt.length,
        responseLength: content.length,
        usage: response.usage
      });

      return content;
    } catch (error) {
      logger.error('OpenAI API error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw this.handleOpenAIError(error);
    }
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
      if (error.message.includes('rate_limit')) {
        return new Error('OpenAI API rate limit exceeded. Please try again later.');
      }
      if (error.message.includes('insufficient_quota')) {
        return new Error('OpenAI API quota exceeded. Please check your API key.');
      }
      if (error.message.includes('invalid_api_key')) {
        return new Error('Invalid OpenAI API key.');
      }
      return new Error(`OpenAI API error: ${error.message}`);
    }
    return new Error('Unknown OpenAI API error');
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
