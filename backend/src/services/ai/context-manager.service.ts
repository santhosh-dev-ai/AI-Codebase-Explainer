import { ChatMessage } from '../../types/ai.types';
import logger from '../../utils/logger.util';
import { openaiService } from './openai.service';

interface ContextWindow {
  systemPrompt: string;
  currentFile: string;
  relatedFiles: string[];
  chatHistory: ChatMessage[];
  totalTokens: number;
}

export class ContextManagerService {
  private readonly CONTEXT_LIMIT = 8000; // tokens
  private readonly TOKEN_ALLOCATION = {
    system: 500,
    currentFile: 3000,
    relatedFiles: 2500,
    chatHistory: 1500,
    responseBuffer: 500,
  };

  buildContext(
    systemPrompt: string,
    currentFile: string,
    relatedFiles: string[] = [],
    chatHistory: ChatMessage[] = []
  ): ContextWindow {
    logger.debug('Building context window');

    let totalTokens = 0;
    const context: ContextWindow = {
      systemPrompt,
      currentFile: '',
      relatedFiles: [],
      chatHistory: [],
      totalTokens: 0,
    };

    // Add system prompt
    const systemTokens = openaiService.estimateTokens(systemPrompt);
    if (systemTokens <= this.TOKEN_ALLOCATION.system) {
      context.systemPrompt = systemPrompt;
      totalTokens += systemTokens;
    } else {
      context.systemPrompt = openaiService.truncateToTokenLimit(
        systemPrompt,
        this.TOKEN_ALLOCATION.system
      );
      totalTokens += this.TOKEN_ALLOCATION.system;
    }

    // Add current file
    const fileTokens = openaiService.estimateTokens(currentFile);
    if (fileTokens <= this.TOKEN_ALLOCATION.currentFile) {
      context.currentFile = currentFile;
      totalTokens += fileTokens;
    } else {
      context.currentFile = openaiService.truncateToTokenLimit(
        currentFile,
        this.TOKEN_ALLOCATION.currentFile
      );
      totalTokens += this.TOKEN_ALLOCATION.currentFile;
    }

    // Add related files (within budget)
    let relatedTokensUsed = 0;
    for (const relatedFile of relatedFiles) {
      const tokens = openaiService.estimateTokens(relatedFile);
      if (relatedTokensUsed + tokens <= this.TOKEN_ALLOCATION.relatedFiles) {
        context.relatedFiles.push(relatedFile);
        relatedTokensUsed += tokens;
      } else {
        // Truncate to fit
        const remaining = this.TOKEN_ALLOCATION.relatedFiles - relatedTokensUsed;
        if (remaining > 100) {
          // Only add if meaningful space left
          context.relatedFiles.push(
            openaiService.truncateToTokenLimit(relatedFile, remaining)
          );
          relatedTokensUsed += remaining;
        }
        break;
      }
    }
    totalTokens += relatedTokensUsed;

    // Add chat history (most recent first, within budget)
    const reversedHistory = [...chatHistory].reverse();
    let historyTokensUsed = 0;

    for (const message of reversedHistory) {
      const messageText = `${message.role}: ${message.content}`;
      const tokens = openaiService.estimateTokens(messageText);

      if (historyTokensUsed + tokens <= this.TOKEN_ALLOCATION.chatHistory) {
        context.chatHistory.unshift(message);
        historyTokensUsed += tokens;
      } else {
        break;
      }
    }
    totalTokens += historyTokensUsed;

    context.totalTokens = totalTokens;

    logger.info('Context window built', {
      totalTokens,
      systemTokens,
      currentFileTokens: fileTokens,
      relatedFilesCount: context.relatedFiles.length,
      chatHistoryCount: context.chatHistory.length
    });

    return context;
  }

  summarizeChatHistory(messages: ChatMessage[]): string {
    if (messages.length === 0) {
      return '';
    }

    // Create a summary of older messages
    const summary = messages
      .slice(0, -5) // Exclude last 5 messages
      .map(m => `${m.role}: ${m.content.substring(0, 100)}...`)
      .join('\n');

    return `Previous conversation summary:\n${summary}`;
  }

  prioritizeRelatedFiles(
    currentFilePath: string,
    allFiles: Map<string, string>
  ): string[] {
    logger.debug('Prioritizing related files', { currentFile: currentFilePath });

    const related: Array<{ path: string; score: number }> = [];

    for (const [path, content] of allFiles.entries()) {
      if (path === currentFilePath) continue;

      let score = 0;

      // Same directory: +3
      const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
      const fileDir = path.substring(0, path.lastIndexOf('/'));
      if (currentDir === fileDir) {
        score += 3;
      }

      // Parent/child directory: +2
      if (currentDir.startsWith(fileDir) || fileDir.startsWith(currentDir)) {
        score += 2;
      }

      // Referenced in imports: +5
      if (content.includes(path) || content.includes(path.replace(/\.\w+$/, ''))) {
        score += 5;
      }

      if (score > 0) {
        related.push({ path, score });
      }
    }

    // Sort by score descending
    related.sort((a, b) => b.score - a.score);

    // Return top 5 file paths
    const topPaths = related.slice(0, 5).map(r => r.path);

    logger.debug('Related files prioritized', {
      total: related.length,
      selected: topPaths.length
    });

    return topPaths;
  }

  extractCodeContext(
    filePath: string,
    content: string
  ): { imports: string[]; exports: string[]; functions: string[] } {
    const imports: string[] = [];
    const exports: string[] = [];
    const functions: string[] = [];

    // Extract imports
    const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Extract exports
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Extract function names
    const functionRegex = /function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|class\s+(\w+)/g;
    while ((match = functionRegex.exec(content)) !== null) {
      const funcName = match[1] || match[2] || match[3];
      if (funcName) {
        functions.push(funcName);
      }
    }

    return { imports, exports, functions };
  }
}

export const contextManagerService = new ContextManagerService();
