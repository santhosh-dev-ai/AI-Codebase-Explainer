import { Request, Response, NextFunction } from 'express';
import { githubService } from '../services/repository/github.service';
import { zipParserService } from '../services/repository/zip-parser.service';
import { fileTreeService } from '../services/repository/file-tree.service';
import { sessionService } from '../services/storage/session.service';
import { isValidGitHubUrl, parseGitHubUrl } from '../services/repository/validation.service';
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
      const repoTarget = parseGitHubUrl(githubUrl);
      const repoName = repoTarget?.repo || 'repository';
      const fileTree = fileTreeService.generateFileTree(filteredFiles);
      const metadata = fileTreeService.generateMetadata(filteredFiles, repoName);

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
      const zipName = req.file.originalname.replace(/\.[^/.]+$/, '').trim() || 'uploaded-project';
      const fileTree = fileTreeService.generateFileTree(filteredFiles);
      const metadata = fileTreeService.generateMetadata(filteredFiles, zipName);
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
      const filePath = (req.query.filePath || req.query.path || req.body?.filePath || req.body?.path) as string;

      if (!filePath) {
        throw createError('File path is required', 400);
      }

      const actualPath = sessionService.resolveFilePath(sessionId, filePath) || filePath;
      const content = sessionService.getFileContent(sessionId, filePath);
      if (content === null) {
        throw createError(`File not found: ${filePath}`, 404);
      }

      const language = detectLanguage(actualPath);
      const lines = content.split('\n').length;
      const size = Buffer.byteLength(content, 'utf8');

      res.status(200).json({
        success: true,
        data: {
          path: actualPath,
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
