import path from 'path';
import { FileNode, RepoMetadata } from '../../types/repository.types';
import {
  shouldExcludeFile,
  shouldExcludeDirectory,
  detectLanguage,
  calculateDepth
} from '../../utils/file-processor.util';
import logger from '../../utils/logger.util';

export class FileTreeService {
  generateFileTree(files: Map<string, string>): FileNode[] {
    logger.info('Generating file tree', { fileCount: files.size });

    const root: Map<string, FileNode> = new Map();

    for (const [filePath, content] of files.entries()) {
      const parts = filePath.split('/').filter(Boolean);
      this.addToTree(root, parts, filePath, content);
    }

    const tree = Array.from(root.values()).sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    logger.info('File tree generated successfully', { rootNodes: tree.length });
    return tree;
  }

  private addToTree(
    current: Map<string, FileNode>,
    parts: string[],
    fullPath: string,
    content: string
  ): void {
    if (parts.length === 0) return;

    const [head, ...tail] = parts;

    if (!current.has(head)) {
      const isFile = tail.length === 0;
      const node: FileNode = {
        name: head,
        path: fullPath,
        type: isFile ? 'file' : 'directory',
        ...(isFile && {
          size: Buffer.byteLength(content, 'utf8'),
          extension: path.extname(head) || undefined,
          language: detectLanguage(head),
        }),
        ...(!isFile && { children: [] }),
      };

      current.set(head, node);
    }

    if (tail.length > 0) {
      const node = current.get(head)!;
      if (node.type === 'directory' && node.children) {
        const childMap = new Map(node.children.map(child => [child.name, child]));
        this.addToTree(childMap, tail, fullPath, content);
        node.children = Array.from(childMap.values()).sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
      }
    }
  }

  generateMetadata(files: Map<string, string>): RepoMetadata {
    logger.info('Generating repository metadata');

    const languages: Record<string, number> = {};
    const fileTypes: Record<string, number> = {};
    let totalSize = 0;
    let maxDepth = 0;
let totalFiles = 0;

    for (const [filePath, content] of files.entries()) {
      const size = Buffer.byteLength(content, 'utf8');

      // Skip if should be excluded
      if (shouldExcludeFile(filePath, size)) {
        continue;
      }

      totalFiles++;
      totalSize += size;

      // Track language
      const language = detectLanguage(filePath);
      languages[language] = (languages[language] || 0) + 1;

      // Track file type
      const ext = path.extname(filePath) || 'no extension';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;

      // Track max depth
      const depth = calculateDepth(filePath);
      maxDepth = Math.max(maxDepth, depth);
    }

    // Extract repo name from first file path
    const firstPath = Array.from(files.keys())[0] || 'unknown';
    const repoName = firstPath.split('/')[0] || 'unknown';

    const metadata: RepoMetadata = {
      name: repoName,
      totalFiles,
      totalSize,
      languages,
      fileTypes,
      depth: maxDepth,
    };

    logger.info('Metadata generated', metadata);
    return metadata;
  }

  filterLargeRepository(
    files: Map<string, string>,
    maxFiles: number = 1000
  ): Map<string, string> {
    if (files.size <= maxFiles) {
      return files;
    }

    logger.warn('Repository too large, sampling files', {
      total: files.size,
      max: maxFiles
    });

    const priorityFiles: string[] = [];
    const regularFiles: string[] = [];

    // Priority file patterns
    const priorityPatterns = [
      /package\.json$/,
      /requirements\.txt$/,
      /composer\.json$/,
      /Cargo\.toml$/,
      /go\.mod$/,
      /pom\.xml$/,
      /README/i,
      /tsconfig\.json$/,
      /webpack\.config/,
      /vite\.config/,
      /index\.(js|ts|jsx|tsx)$/,
      /main\.(js|ts|py|go|rs|java)$/,
      /app\.(js|ts|jsx|tsx)$/,
    ];

    for (const filePath of files.keys()) {
      const isPriority = priorityPatterns.some(pattern => pattern.test(filePath));
      if (isPriority) {
        priorityFiles.push(filePath);
      } else {
        regularFiles.push(filePath);
      }
    }

    // Take all priority files + sample of regular files
    const numRegularToInclude = Math.max(0, maxFiles - priorityFiles.length);
    const sampledRegular = this.sampleFiles(regularFiles, numRegularToInclude);

    const selectedPaths = [...priorityFiles, ...sampledRegular];
    const filteredFiles = new Map<string, string>();

    for (const filePath of selectedPaths) {
      const content = files.get(filePath);
      if (content !== undefined) {
        filteredFiles.set(filePath, content);
      }
    }

    logger.info('Repository filtered', {
      original: files.size,
      filtered: filteredFiles.size
    });

    return filteredFiles;
  }

  private sampleFiles(files: string[], count: number): string[] {
    if (files.length <= count) {
      return files;
    }

    // Stratified sampling by directory
    const byDirectory = new Map<string, string[]>();

    for (const file of files) {
      const dir = path.dirname(file);
      if (!byDirectory.has(dir)) {
        byDirectory.set(dir, []);
      }
      byDirectory.get(dir)!.push(file);
    }

    // Sample proportionally from each directory
    const sampled: string[] = [];
    const dirsArray = Array.from(byDirectory.entries());
    const filesPerDir = Math.ceil(count / dirsArray.length);

    for (const [, dirFiles] of dirsArray) {
      const take = Math.min(filesPerDir, dirFiles.length);
      const step = Math.floor(dirFiles.length / take);

      for (let i = 0; i < dirFiles.length && sampled.length < count; i += Math.max(1, step)) {
        sampled.push(dirFiles[i]);
      }
    }

    return sampled.slice(0, count);
  }
}

export const fileTreeService = new FileTreeService();
