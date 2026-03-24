import { Router } from 'express';
import multer from 'multer';
import { repositoryController } from '../controllers/repository.controller';
import {
  validateGitHubUrl,
  validateSessionId,
  validateFilePath,
} from '../middleware/validation.middleware';
import { strictRateLimiter } from '../middleware/rate-limiter.middleware';
import config from '../config/env.config';

const router = Router();

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      cb(new Error('Only ZIP files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// Analyze GitHub repository
router.post(
  '/analyze-github',
  strictRateLimiter,
  validateGitHubUrl,
  repositoryController.analyzeGitHub.bind(repositoryController)
);

// Upload ZIP file
router.post(
  '/upload-zip',
  strictRateLimiter,
  upload.single('file'),
  repositoryController.uploadZip.bind(repositoryController)
);

// Get file content
router.get(
  '/:sessionId/file',
  validateSessionId,
  validateFilePath,
  repositoryController.getFile.bind(repositoryController)
);

// Get file tree
router.get(
  '/:sessionId/tree',
  validateSessionId,
  repositoryController.getFileTree.bind(repositoryController)
);

export default router;
