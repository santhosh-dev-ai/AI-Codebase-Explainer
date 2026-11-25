import { promptBuilderService } from './prompt-builder.service';
import { openaiService } from './openai.service';
import { contextManagerService } from './context-manager.service';
import { sessionService } from '../storage/session.service';
import type { ChatMessage, CodeContext, FileReference } from '../../types/ai.types';
import logger from '../../utils/logger.util';
import config from '../../config/env.config';

interface ChatResult {
  response: string;
  references: FileReference[];
}

export class ChatService {
  private chatHistory = new Map<string, ChatMessage[]>();

  constructor() {
    sessionService.onSessionDeleted((sessionId) => {
      this.clearHistory(sessionId);
      logger.info('Chat history cleared on session deletion', { sessionId });
    });
  }

  private prepareChatContext(
    sessionId: string,
    message: string,
    context?: CodeContext
  ) {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const history = this.chatHistory.get(sessionId) || [];
    const files = session.files;

    // Smart path resolver: exact match, normalized path, or matching entry
    let currentFilePath: string | undefined = undefined;
    if (context?.currentFile) {
      if (files.has(context.currentFile)) {
        currentFilePath = context.currentFile;
      } else {
        const norm = context.currentFile.replace(/^[./\\]+/, '').replace(/\\/g, '/');
        for (const k of files.keys()) {
          const normKey = k.replace(/^[./\\]+/, '').replace(/\\/g, '/');
          if (normKey === norm || normKey.endsWith('/' + norm) || norm.endsWith('/' + normKey)) {
            currentFilePath = k;
            break;
          }
        }
      }
    }

    const explicitRelated = (context?.relatedFiles || []).filter((filePath) => files.has(filePath));
    const inferredRelated = currentFilePath
      ? contextManagerService.prioritizeRelatedFiles(currentFilePath, files)
      : [];

    const relatedPaths = Array.from(new Set([...explicitRelated, ...inferredRelated])).slice(0, 5);

    const systemPrompt = promptBuilderService.buildChatSystemPrompt(
      currentFilePath,
      session.metadata.name,
      relatedPaths
    );

    const codeContext = this.buildCodeContext(files, currentFilePath, relatedPaths, context);
    const historySummary = contextManagerService.summarizeChatHistory(history);
    const prompt = promptBuilderService.buildChatPrompt(message, codeContext, historySummary);

    const references: FileReference[] = [];
    if (currentFilePath) {
      references.push({
        path: currentFilePath,
        reason: 'Current file context',
      });
    }

    relatedPaths.forEach((path) => {
      references.push({
        path,
        reason: 'Related file context',
      });
    });

    return {
      session,
      history,
      systemPrompt,
      prompt,
      references,
    };
  }

  async sendMessage(sessionId: string, message: string, context?: CodeContext): Promise<ChatResult> {
    const { history, systemPrompt, prompt, references } = this.prepareChatContext(
      sessionId,
      message,
      context
    );

    const response = await openaiService.generateCompletion(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 2500,
    });

    const userMessage: ChatMessage = {
      id: this.nextMessageId('user'),
      role: 'user',
      content: message,
      timestamp: new Date(),
      context,
      references,
    };

    const assistantMessage: ChatMessage = {
      id: this.nextMessageId('assistant'),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      context,
      references,
    };

    const updatedHistory = [...history, userMessage, assistantMessage];
    const maxHistory = config.maxChatHistoryPerSession;
    const boundedHistory =
      updatedHistory.length > maxHistory
        ? updatedHistory.slice(updatedHistory.length - maxHistory)
        : updatedHistory;

    this.chatHistory.set(sessionId, boundedHistory);

    logger.info('Chat response generated', {
      sessionId,
      messageLength: message.length,
      responseLength: response.length,
      references: references.length,
      historyCount: this.chatHistory.get(sessionId)?.length || 0,
    });

    return {
      response,
      references,
    };
  }

  async streamMessage(
    sessionId: string,
    message: string,
    context: CodeContext | undefined,
    onChunk: (chunk: string) => void,
    options?: { abortSignal?: AbortSignal }
  ): Promise<ChatResult> {
    const { history, systemPrompt, prompt, references } = this.prepareChatContext(
      sessionId,
      message,
      context
    );

    const stream = await openaiService.generateStreamingCompletion(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 2500,
      abortSignal: options?.abortSignal,
    });

    let fullResponse = '';

    try {
      for await (const chunk of stream) {
        if (options?.abortSignal?.aborted) {
          logger.info('Streaming aborted by client', { sessionId });
          break;
        }

        const delta = chunk.choices[0]?.delta;
        let text = delta?.content || '';
        if (!text && typeof (delta as any)?.reasoning === 'string') {
          text = (delta as any).reasoning;
        }

        if (text) {
          fullResponse += text;
          onChunk(text);
        }
      }
    } catch (err: any) {
      if (options?.abortSignal?.aborted) {
        logger.info('Stream closed on client abort', { sessionId });
      } else {
        throw err;
      }
    }

    const finalResponse =
      fullResponse ||
      (options?.abortSignal?.aborted
        ? '[Response stopped by user]'
        : 'No response generated.');

    const userMessage: ChatMessage = {
      id: this.nextMessageId('user'),
      role: 'user',
      content: message,
      timestamp: new Date(),
      context,
      references,
    };

    const assistantMessage: ChatMessage = {
      id: this.nextMessageId('assistant'),
      role: 'assistant',
      content: finalResponse,
      timestamp: new Date(),
      context,
      references,
    };

    const updatedHistory = [...history, userMessage, assistantMessage];
    const maxHistory = config.maxChatHistoryPerSession;
    const boundedHistory =
      updatedHistory.length > maxHistory
        ? updatedHistory.slice(updatedHistory.length - maxHistory)
        : updatedHistory;

    this.chatHistory.set(sessionId, boundedHistory);

    logger.info('Chat stream completed', {
      sessionId,
      messageLength: message.length,
      responseLength: finalResponse.length,
      references: references.length,
      historyCount: this.chatHistory.get(sessionId)?.length || 0,
      aborted: !!options?.abortSignal?.aborted,
    });

    return {
      response: finalResponse,
      references,
    };
  }

  getHistory(sessionId: string): ChatMessage[] {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return this.chatHistory.get(sessionId) || [];
  }

  clearHistory(sessionId: string): boolean {
    return this.chatHistory.delete(sessionId);
  }

  getHistoryCount(sessionId: string): number {
    return this.chatHistory.get(sessionId)?.length || 0;
  }

  private buildCodeContext(
    files: Map<string, string>,
    currentFilePath?: string,
    relatedPaths: string[] = [],
    context?: CodeContext
  ): string {
    const blocks: string[] = [];

    if (currentFilePath) {
      const content = files.get(currentFilePath) || '';
      blocks.push(`Current file: ${currentFilePath}\n${this.makeSnippet(content, 2200)}`);
    }

    relatedPaths.forEach((path) => {
      const content = files.get(path) || '';
      blocks.push(`Related file: ${path}\n${this.makeSnippet(content, 1000)}`);
    });

    if (context?.selectedCode) {
      const lineRange = context.lineRange ? `Lines ${context.lineRange.start}-${context.lineRange.end}` : 'Selected snippet';
      blocks.push(`${lineRange}:\n${context.selectedCode}`);
    }

    if (blocks.length === 0) {
      const topFiles = Array.from(files.keys()).slice(0, 3);
      topFiles.forEach((path) => {
        const content = files.get(path) || '';
        blocks.push(`Representative file: ${path}\n${this.makeSnippet(content, 800)}`);
      });
    }

    return blocks.join('\n\n');
  }

  private makeSnippet(content: string, maxChars: number): string {
    if (content.length <= maxChars) {
      return content;
    }
    return `${content.slice(0, maxChars)}\n...`;
  }

  private nextMessageId(prefix: 'user' | 'assistant'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export const chatService = new ChatService();
