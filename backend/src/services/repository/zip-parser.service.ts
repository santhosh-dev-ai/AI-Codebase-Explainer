import JSZip from 'jszip';
import logger from '../../utils/logger.util';
import config from '../../config/env.config';
import { shouldExcludeFile, shouldExcludeDirectory, redactSecretContent } from '../../utils/file-processor.util';

export class ZipParserService {
  private readonly MAX_TOTAL_UNCOMPRESSED = 150 * 1024 * 1024; // 150MB cumulative safety limit
  private readonly MAX_SINGLE_FILE_SIZE = 500 * 1024; // 500KB per text file
  private readonly MAX_ENTRY_COUNT = 10000; // Maximum number of entries in archive
  private readonly MAX_PATH_DEPTH = 30; // Maximum directory nesting depth
  private readonly MAX_PATH_LENGTH = 1024; // Maximum path length
  private readonly MAX_PROCESSING_TIME_MS = 60000; // 60 seconds processing timeout
  private readonly MAX_COMPRESSION_RATIO = 100; // 100:1 compression ratio limit

  async parseZipFile(buffer: Buffer, abortSignal?: AbortSignal): Promise<Map<string, string>> {
    logger.info('Parsing ZIP file with secure streaming decompression');

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Invalid or empty ZIP archive buffer');
    }

    if (buffer.length > config.maxFileSize) {
      throw new Error(
        `ZIP archive size (${Math.round(buffer.length / (1024 * 1024))}MB) exceeds maximum allowed limit of ${Math.round(config.maxFileSize / (1024 * 1024))}MB`
      );
    }

    const startTime = Date.now();

    try {
      const zip = await JSZip.loadAsync(buffer);
      const files = new Map<string, string>();
      const seenNormalizedPaths = new Set<string>();
      const seenLowerPaths = new Map<string, string>();
      let totalUncompressedBytes = 0;

      const zipEntries = Object.entries(zip.files);

      if (zipEntries.length === 0) {
        throw new Error('ZIP archive is empty');
      }

      if (zipEntries.length > this.MAX_ENTRY_COUNT) {
        throw new Error(
          `ZIP archive contains too many entries (${zipEntries.length} entries, max allowed: ${this.MAX_ENTRY_COUNT})`
        );
      }

      // Detect common top-level directory prefix (e.g. project-main/ or owner-repo-sha/)
      let prefix = '';
      const entryNames = Object.keys(zip.files);
      if (entryNames.length > 0) {
        const firstSlash = entryNames[0].indexOf('/');
        if (firstSlash !== -1) {
          const candidatePrefix = entryNames[0].substring(0, firstSlash + 1);
          if (entryNames.every((name) => name.startsWith(candidatePrefix))) {
            prefix = candidatePrefix;
          }
        }
      }

      for (const [rawPath, zipEntry] of zipEntries) {
        if (abortSignal?.aborted) {
          throw new Error('ZIP extraction aborted: client disconnected');
        }

        // Enforce maximum processing duration to prevent CPU exhaustion
        if (Date.now() - startTime > this.MAX_PROCESSING_TIME_MS) {
          throw new Error('ZIP extraction aborted: processing exceeded maximum time limit of 60 seconds.');
        }

        if (zipEntry.dir) {
          continue;
        }

        // 1. Safe Symlink handling: skip symbolic links without resolving target
        const isSymlink = Boolean(
          typeof zipEntry.unixPermissions === 'number' &&
            (zipEntry.unixPermissions & 0o170000) === 0o120000
        );
        if (isSymlink) {
          logger.warn('Skipping symbolic link entry in ZIP archive', { path: rawPath });
          continue;
        }

        // 2. Sanitize and reject unsafe paths, directory traversal, drive letters, control characters
        // Check raw entry path
        const normalizedPath = rawPath.replace(/\\/g, '/');
        const isPathTraversal =
          normalizedPath.includes('..') ||
          normalizedPath.startsWith('/') ||
          normalizedPath.includes('~') ||
          /^[a-zA-Z]:/.test(normalizedPath) ||
          /\0/.test(normalizedPath) ||
          /[\x00-\x1f\x7f]/.test(normalizedPath) ||
          normalizedPath.length > this.MAX_PATH_LENGTH;

        if (isPathTraversal) {
          logger.warn('Skipping malicious or unsafe path traversal entry in ZIP', { path: rawPath });
          continue;
        }

        // Check raw un-normalized header string from JSZip if present
        const unsafeOriginal = (zipEntry as any).unsafeOriginalName;
        if (typeof unsafeOriginal === 'string') {
          const normOriginal = unsafeOriginal.replace(/\\/g, '/');
          const isUnsafeOriginal =
            normOriginal.includes('..') ||
            normOriginal.startsWith('/') ||
            normOriginal.includes('~') ||
            /^[a-zA-Z]:/.test(normOriginal) ||
            /\0/.test(normOriginal) ||
            /[\x00-\x1f\x7f]/.test(normOriginal);
          if (isUnsafeOriginal) {
            logger.warn('Skipping entry with malicious unsafe original path in ZIP', {
              path: rawPath,
              unsafeOriginalName: unsafeOriginal,
            });
            continue;
          }
        }

        // 3. Strip common top-level prefix if present
        let relativePath = normalizedPath;
        if (prefix && relativePath.startsWith(prefix)) {
          relativePath = relativePath.substring(prefix.length);
        }

        if (!relativePath) {
          continue;
        }

        // Clean redundant slashes, leading ./, and verify normalized safety
        let cleanPath = relativePath.replace(/\/+/g, '/');
        if (cleanPath.startsWith('./')) {
          cleanPath = cleanPath.substring(2);
        }

        if (
          cleanPath === '..' ||
          cleanPath.startsWith('../') ||
          cleanPath.includes('/../') ||
          cleanPath.endsWith('/..') ||
          cleanPath.startsWith('/')
        ) {
          logger.warn('Skipping unsafe normalized path traversal in ZIP', { path: cleanPath, original: rawPath });
          continue;
        }

        // Reject duplicate normalized path collisions and case-collision overwrites
        if (seenNormalizedPaths.has(cleanPath)) {
          logger.warn('Skipping duplicate normalized path collision in ZIP archive', { path: cleanPath });
          continue;
        }
        seenNormalizedPaths.add(cleanPath);

        const lowerClean = cleanPath.toLowerCase();
        if (seenLowerPaths.has(lowerClean)) {
          logger.warn('Skipping case-collision normalized path in ZIP archive', {
            path: cleanPath,
            collidesWith: seenLowerPaths.get(lowerClean),
          });
          continue;
        }
        seenLowerPaths.set(lowerClean, cleanPath);

        // 4. Excessive directory nesting protection
        const pathParts = cleanPath.split('/');
        if (pathParts.length > this.MAX_PATH_DEPTH) {
          logger.warn('Skipping entry exceeding maximum directory nesting depth', {
            path: cleanPath,
            depth: pathParts.length,
          });
          continue;
        }

        // 5. Check directory and file exclusion patterns (.git, node_modules, binaries, etc.)
        const shouldSkip = pathParts.some((part, index) => {
          if (index === pathParts.length - 1) {
            return shouldExcludeFile(cleanPath);
          }
          return shouldExcludeDirectory(part);
        });

        if (shouldSkip) {
          logger.debug('Skipping excluded file or directory in ZIP', { path: cleanPath });
          continue;
        }

        // 6. Safe streaming decompression with chunk-by-chunk byte counters & early abort
        const extracted = await this.streamEntryToString(
          zipEntry,
          cleanPath,
          totalUncompressedBytes,
          abortSignal
        );

        if (!extracted) {
          continue;
        }

        totalUncompressedBytes += extracted.bytes;
        files.set(cleanPath, extracted.content);
      }

      logger.info('ZIP file parsed successfully', {
        fileCount: files.size,
        totalBytes: totalUncompressedBytes,
        durationMs: Date.now() - startTime,
      });

      return files;
    } catch (error) {
      logger.error('Error parsing ZIP file', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to parse ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Safely decompresses a single ZIP entry via Node stream.
   * Enforces single-file limits, cumulative limits, early binary detection, and ratio checks
   * without allocating oversized strings into memory.
   */
  private async streamEntryToString(
    zipEntry: JSZip.JSZipObject,
    path: string,
    currentTotalBytes: number,
    abortSignal?: AbortSignal
  ): Promise<{ content: string; bytes: number } | null> {
    return new Promise((resolve, reject) => {
      const stream: any = zipEntry.nodeStream('nodebuffer');
      let entryBytes = 0;
      const chunks: Buffer[] = [];
      let aborted = false;

      const cleanup = () => {
        if (abortSignal && onAbort) {
          abortSignal.removeEventListener('abort', onAbort);
        }
      };

      const onAbort = () => {
        if (!aborted) {
          aborted = true;
          try {
            stream.destroy();
          } catch {}
          cleanup();
          reject(new Error('ZIP extraction aborted: client disconnected'));
        }
      };

      if (abortSignal?.aborted) {
        onAbort();
        return;
      }

      if (abortSignal) {
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }

      stream.on('data', (chunk: Buffer) => {
        if (aborted) return;

        entryBytes += chunk.length;

        // 1. Enforce individual expanded file limit
        if (entryBytes > this.MAX_SINGLE_FILE_SIZE) {
          aborted = true;
          stream.destroy();
          cleanup();
          logger.debug('Skipping oversized text file during streaming decompression', {
            path,
            size: entryBytes,
          });
          resolve(null);
          return;
        }

        // 2. Enforce cumulative expanded size limit
        if (currentTotalBytes + entryBytes > this.MAX_TOTAL_UNCOMPRESSED) {
          aborted = true;
          stream.destroy();
          cleanup();
          reject(
            new Error(
              'ZIP extraction aborted: uncompressed data exceeds safety limit of 150MB (possible decompression bomb).'
            )
          );
          return;
        }

        // 3. Early binary content detection on the first chunk
        if (chunks.length === 0 && this.isBinaryBuffer(chunk)) {
          aborted = true;
          stream.destroy();
          cleanup();
          logger.debug('Skipping binary file detected during streaming decompression', { path });
          resolve(null);
          return;
        }

        chunks.push(chunk);
      });

      stream.on('end', () => {
        if (aborted) return;
        cleanup();

        // 4. Protect against extreme compression ratios on substantive payloads
        const rawEntry = zipEntry as any;
        const compressedSize = rawEntry?._data?.compressedSize;
        if (
          typeof compressedSize === 'number' &&
          compressedSize > 0 &&
          entryBytes > 100 * 1024
        ) {
          const ratio = entryBytes / compressedSize;
          if (ratio > this.MAX_COMPRESSION_RATIO) {
            aborted = true;
            reject(
              new Error(
                `ZIP extraction aborted: suspicious compression ratio of ${Math.round(ratio)}:1 in ${path} (possible decompression bomb).`
              )
            );
            return;
          }
        }

        const fullBuffer = Buffer.concat(chunks);
        const rawContent = fullBuffer.toString('utf8');
        const content = redactSecretContent(path, rawContent);
        resolve({ content, bytes: entryBytes });
      });

      stream.on('error', (err: any) => {
        if (aborted) return;
        cleanup();
        stream.destroy();
        reject(err);
      });
    });
  }

  private isBinaryBuffer(buffer: Buffer): boolean {
    const sampleSize = Math.min(buffer.length, 4096);
    let nullCount = 0;
    for (let i = 0; i < sampleSize; i++) {
      if (buffer[i] === 0) {
        nullCount++;
        if (nullCount > 1) return true;
      }
    }
    return false;
  }

  validateZipStructure(files: Map<string, string>): { valid: boolean; error?: string } {
    if (files.size === 0) {
      return { valid: false, error: 'ZIP file is empty or contains no supported text source files' };
    }

    if (files.size > this.MAX_ENTRY_COUNT) {
      return {
        valid: false,
        error: `ZIP file contains too many files (max: ${this.MAX_ENTRY_COUNT})`,
      };
    }

    return { valid: true };
  }
}

export const zipParserService = new ZipParserService();
