import { Request, Response, NextFunction } from 'express';
import { createError } from './error-handler.middleware';

export function validateGitHubUrl(req: Request, res: Response, next: NextFunction): void {
  const { githubUrl } = req.body;

  if (!githubUrl || typeof githubUrl !== 'string') {
    return next(createError('GitHub URL is required', 400));
  }

  const githubRegex = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
  if (!githubRegex.test(githubUrl.replace(/\.git$/, ''))) {
    return next(createError('Invalid GitHub URL format', 400));
  }

  next();
}

export function validateSessionId(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.params.sessionId;

  if (!sessionId) {
    return next(createError('Session ID is required', 400));
  }

  // UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    return next(createError('Invalid session ID format', 400));
  }

  next();
}

export function validateFilePath(req: Request, res: Response, next: NextFunction): void {
  const filePath = req.query.filePath as string;

  if (!filePath) {
    return next(createError('File path is required', 400));
  }

  // Check for path traversal attempts
  if (filePath.includes('..') || filePath.includes('~')) {
    return next(createError('Invalid file path', 400));
  }

  next();
}

export function validateChatMessage(req: Request, res: Response, next: NextFunction): void {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return next(createError('Message is required', 400));
  }

  if (message.trim().length === 0) {
    return next(createError('Message cannot be empty', 400));
  }

  if (message.length > 5000) {
    return next(createError('Message is too long (max 5000 characters)', 400));
  }

  next();
}
