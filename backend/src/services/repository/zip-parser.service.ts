import JSZip from 'jszip';
import logger from '../../utils/logger.util';
import { shouldExcludeFile, shouldExcludeDirectory } from '../../utils/file-processor.util';

export class ZipParserService {
  async parseZipFile(buffer: Buffer): Promise<Map<string, string>> {
    logger.info('Parsing ZIP file');

    try {
      const zip = await JSZip.loadAsync(buffer);
      const files = new Map<string, string>();

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) {
          continue;
        }

        // Check if path should be excluded
        const pathParts = relativePath.split('/');
        const shouldSkip = pathParts.some((part, index) => {
          if (index === pathParts.length - 1) {
            // Last part is filename
            return shouldExcludeFile(part);
          }
          // Check directory names
          return shouldExcludeDirectory(part);
        });

        if (shouldSkip) {
          logger.debug('Skipping excluded file', { path: relativePath });
          continue;
        }

        try {
          const content = await zipEntry.async('string');
          files.set(relativePath, content);
        } catch (error) {
          logger.warn('Failed to extract file from ZIP', {
            path: relativePath,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('ZIP file parsed successfully', { fileCount: files.size });
      return files;
    } catch (error) {
      logger.error('Error parsing ZIP file', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to parse ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  validateZipStructure(files: Map<string, string>): { valid: boolean; error?: string } {
    if (files.size === 0) {
      return { valid: false, error: 'ZIP file is empty' };
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
