import JSZip from 'jszip';
import logger from '../../utils/logger.util';
import { shouldExcludeFile, shouldExcludeDirectory } from '../../utils/file-processor.util';

export class ZipParserService {
  private readonly MAX_TOTAL_UNCOMPRESSED = 150 * 1024 * 1024; // 150MB cumulative safety limit
  private readonly MAX_SINGLE_FILE_SIZE = 500 * 1024; // 500KB per text file

  async parseZipFile(buffer: Buffer): Promise<Map<string, string>> {
    logger.info('Parsing ZIP file');

    try {
      const zip = await JSZip.loadAsync(buffer);
      const files = new Map<string, string>();
      let totalUncompressedBytes = 0;

      // Detect common top-level directory prefix (e.g. project-main/)
      let prefix = '';
      const zipKeys = Object.keys(zip.files);
      if (zipKeys.length > 0) {
        const firstParts = zipKeys[0].split('/');
        if (firstParts.length > 1 && zipKeys.every(k => k.startsWith(firstParts[0] + '/'))) {
          prefix = firstParts[0] + '/';
        }
      }

      for (const [rawPath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) {
          continue;
        }

        // Sanitize and guard against path traversal attempts
        if (rawPath.includes('..') || rawPath.startsWith('/') || rawPath.includes('~')) {
          logger.warn('Skipping potentially malicious path traversal in ZIP', { path: rawPath });
          continue;
        }

        // Strip common prefix if detected
        let relativePath = rawPath;
        if (prefix && relativePath.startsWith(prefix)) {
          relativePath = relativePath.substring(prefix.length);
        }

        if (!relativePath) {
          continue;
        }

        // Check if path should be excluded
        const pathParts = relativePath.split('/');
        const shouldSkip = pathParts.some((part, index) => {
          if (index === pathParts.length - 1) {
            return shouldExcludeFile(part);
          }
          return shouldExcludeDirectory(part);
        });

        if (shouldSkip) {
          logger.debug('Skipping excluded file', { path: relativePath });
          continue;
        }

        try {
          const content = await zipEntry.async('string');

          // Check individual file size limit
          if (content.length > this.MAX_SINGLE_FILE_SIZE) {
            logger.debug('Skipping oversized text file in ZIP', { path: relativePath, size: content.length });
            continue;
          }

          // Check for binary content
          if (this.isBinaryContent(content)) {
            logger.debug('Skipping binary file in ZIP', { path: relativePath });
            continue;
          }

          totalUncompressedBytes += Buffer.byteLength(content, 'utf8');
          if (totalUncompressedBytes > this.MAX_TOTAL_UNCOMPRESSED) {
            throw new Error('ZIP extraction aborted: uncompressed data exceeds safety limit of 150MB (possible decompression bomb).');
          }

          files.set(relativePath, content);
        } catch (error) {
          if (error instanceof Error && error.message.includes('safety limit')) {
            throw error;
          }
          logger.warn('Failed to extract file from ZIP', {
            path: relativePath,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('ZIP file parsed successfully', {
        fileCount: files.size,
        totalBytes: totalUncompressedBytes
      });
      return files;
    } catch (error) {
      logger.error('Error parsing ZIP file', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to parse ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isBinaryContent(content: string): boolean {
    const sampleSize = Math.min(content.length, 8000);
    const sample = content.substring(0, sampleSize);

    let nullCount = 0;
    for (let i = 0; i < sample.length; i++) {
      if (sample.charCodeAt(i) === 0) {
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

    if (files.size > 10000) {
      return {
        valid: false,
        error: 'ZIP file contains too many files (max: 10,000)'
      };
    }

    return { valid: true };
  }
}

export const zipParserService = new ZipParserService();
