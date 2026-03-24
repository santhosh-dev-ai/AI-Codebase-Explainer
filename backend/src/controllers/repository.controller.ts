import { Request, Response, NextFunction } from 'express';
import { githubService } from '../services/repository/github.service';
import { zipParserService } from '../services/repository/zip-parser.service';
import { fileTreeService } from '../services/repository/file-tree.service';
import { sessionService } from '../services/storage/session.service';
import { isValidGitHubUrl } from '../services/repository/validation.service';
import { createError } from '../middleware/error-handler.middleware';
import logger from '../utils/logger.util';
import { detectLanguage } from '../utils/file-processor.util';

export class RepositoryController {
  async analyzeGitHub(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { githubUrl, branch } = req.body;

      if (!isValidGitHubUrl(githubUrl)) {
        throw createError('Invalid GitHub URL', 400);
      }

      logger.info('Analyzing GitHub repository', { githubUrl, branch });

      // Fetch repository
      const files = await githubService.fetchRepository(githubUrl);

      // Filter large repositories
      const filteredFiles = fileTreeService.filterLargeRepository(files);

      // Generate file tree and metadata
      const fileTree = fileTreeService.generateFileTree(filteredFiles);
      const metadata = fileTreeService.generateMetadata(filteredFiles);

      // Create session
      const sessionId = sessionService.createSession({
        fileTree,
        metadata,
        files: filteredFiles,
        source: 'github',
        sourceUrl: githubUrl,
      });

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          fileTree,
          metadata,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadZip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw createError('No file uploaded', 400);
      }

      logger.info('Processing uploaded ZIP file', {
        filename: req.file.originalname,
        size: req.file.size
      });

      // Parse ZIP file
      const files = await zipParserService.parseZipFile(req.file.buffer);

      // Validate structure
      const validation = zipParserService.validateZipStructure(files);
      if (!validation.valid) {
        throw createError(validation.error || 'Invalid ZIP structure', 400);
      }

      // Filter large repositories
      const filteredFiles = fileTreeService.filterLargeRepository(files);

      // Generate file tree and metadata
      const fileTree = fileTreeService.generateFileTree(filteredFiles);
      const metadata = fileTreeService.generateMetadata(filteredFiles);

      // Create session
      const sessionId = sessionService.createSession({
        fileTree,
        metadata,
        files: filteredFiles,
        source: 'zip',
      });

      res.status(200).json({
        success: true,
        data: {
          sessionId,
          fileTree,
          metadata,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const filePath = req.query.filePath as string;

      const content = sessionService.getFileContent(sessionId, filePath);
      if (!content) {
        throw createError('File not found', 404);
      }

      const language = detectLanguage(filePath);
      const lines = content.split('\n').length;
      const size = Buffer.byteLength(content, 'utf8');

      res.status(200).json({
        success: true,
        data: {
          path: filePath,
          content,
          language,
          lines,
          size,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getFileTree(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = sessionService.getSession(sessionId);
      if (!session) {
        throw createError('Session not found', 404);
      }

      res.status(200).json({
        success: true,
        data: {
          fileTree: session.fileTree,
          metadata: session.metadata,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const repositoryController = new RepositoryController();
