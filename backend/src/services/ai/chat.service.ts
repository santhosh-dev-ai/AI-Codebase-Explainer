import { promptBuilderService } from './prompt-builder.service';
import { openaiService } from './openai.service';
import { contextManagerService } from './context-manager.service';
import { sessionService } from '../storage/session.service';
import type { ChatMessage, CodeContext, FileReference } from '../../types/ai.types';
import logger from '../../utils/logger.util';

interface ChatResult {
  response: string;
  references: FileReference[];
}

export class ChatService {
  private chatHistory = new Map<string, ChatMessage[]>();

  async sendMessage(sessionId: string, message: string, context?: CodeContext): Promise<ChatResult> {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const history = this.chatHistory.get(sessionId) || [];
    const files = session.files;

    const currentFilePath = context?.currentFile && files.has(context.currentFile)
      ? context.currentFile
      : undefined;

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

    const response = await openaiService.generateCompletion(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 1100,
    });

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

    this.chatHistory.set(sessionId, [...history, userMessage, assistantMessage]);

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

  getHistory(sessionId: string): ChatMessage[] {
    const session = sessionService.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return this.chatHistory.get(sessionId) || [];
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
