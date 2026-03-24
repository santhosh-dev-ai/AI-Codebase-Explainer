import logger from '../../utils/logger.util';

interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
  context: {
    filePath: string;
    imports: string[];
    exports: string[];
  };
}

export class ChunkingService {
  private readonly MAX_CHUNK_SIZE = 1500; // tokens
  private readonly OVERLAP_SIZE = 200; // tokens
  private readonly CHARS_PER_TOKEN = 4;

  chunkCode(
    code: string,
    filePath: string,
    options?: { preserveFunctions?: boolean }
  ): CodeChunk[] {
    logger.debug('Chunking code', { filePath, length: code.length });

    const lines = code.split('\n');
    const chunks: CodeChunk[] = [];

    const imports = this.extractImports(code);
    const exports = this.extractExports(code);

    const maxChunkChars = this.MAX_CHUNK_SIZE * this.CHARS_PER_TOKEN;
    const overlapChars = this.OVERLAP_SIZE * this.CHARS_PER_TOKEN;

    if (code.length <= maxChunkChars) {
      // File is small enough, return as single chunk
      return [{
        content: code,
        startLine: 1,
        endLine: lines.length,
        context: { filePath, imports, exports },
      }];
    }

    // Split by functions/classes if requested
    if (options?.preserveFunctions) {
      const blocks = this.splitByCodeBlocks(code);
      return this.chunkBlocks(blocks, filePath, imports, exports);
    }

    // Simple line-based chunking with overlap
    let currentChunk: string[] = [];
    let currentSize = 0;
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length;

      if (currentSize + lineSize > maxChunkChars && currentChunk.length > 0) {
        // Create chunk
        chunks.push({
          content: currentChunk.join('\n'),
          startLine,
          endLine: i,
          context: { filePath, imports, exports },
        });

        // Prepare overlap
        const overlapLines: string[] = [];
        let overlapSize = 0;
        let j = currentChunk.length - 1;

        while (j >= 0 && overlapSize < overlapChars) {
          overlapLines.unshift(currentChunk[j]);
          overlapSize += currentChunk[j].length;
          j--;
        }

        currentChunk = overlapLines;
        currentSize = overlapSize;
        startLine = i - overlapLines.length + 1;
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        startLine,
        endLine: lines.length,
        context: { filePath, imports, exports },
      });
    }

    logger.info('Code chunked', {
      filePath,
      originalSize: code.length,
      chunks: chunks.length
    });

    return chunks;
  }

  private extractImports(code: string): string[] {
    const imports: string[] = [];

    // JavaScript/TypeScript imports
    const jsImportRegex = /import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]+\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = jsImportRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    // Python imports
    const pyImportRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
    while ((match = pyImportRegex.exec(code)) !== null) {
      imports.push(match[1] || match[2]);
    }

    return [...new Set(imports)];
  }

  private extractExports(code: string): string[] {
    const exports: string[] = [];

    // JavaScript/TypeScript exports
    const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)/g;
    let match;
    while ((match = exportRegex.exec(code)) !== null) {
      exports.push(match[1]);
    }

    // Named exports
    const namedExportRegex = /export\s*\{\s*([^}]+)\s*\}/g;
    while ((match = namedExportRegex.exec(code)) !== null) {
      const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
      exports.push(...names);
    }

    return [...new Set(exports)];
  }

  private splitByCodeBlocks(code: string): string[] {
    // Simple heuristic: split by function/class definitions
    const blockRegex = /^(?:export\s+)?(?:async\s+)?(?:function|class|const|interface|type)\s+\w+/gm;
    const matches: Array<{ index: number; match: string }> = [];
    let match;

    while ((match = blockRegex.exec(code)) !== null) {
      matches.push({ index: match.index, match: match[0] });
    }

    if (matches.length === 0) {
      return [code];
    }

    const blocks: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : code.length;
      blocks.push(code.substring(start, end));
    }

    return blocks;
  }

  private chunkBlocks(
    blocks: string[],
    filePath: string,
    imports: string[],
    exports: string[]
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const maxChunkChars = this.MAX_CHUNK_SIZE * this.CHARS_PER_TOKEN;

    let currentChunk = '';
    let startLine = 1;

    for (const block of blocks) {
      if (currentChunk.length + block.length > maxChunkChars && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk,
          startLine,
          endLine: startLine + currentChunk.split('\n').length - 1,
          context: { filePath, imports, exports },
        });

        currentChunk = block;
        startLine += currentChunk.split('\n').length;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + block;
      }
    }

    if (currentChunk) {
      chunks.push({
        content: currentChunk,
        startLine,
        endLine: startLine + currentChunk.split('\n').length - 1,
        context: { filePath, imports, exports },
      });
    }

    return chunks;
  }
}

export const chunkingService = new ChunkingService();
