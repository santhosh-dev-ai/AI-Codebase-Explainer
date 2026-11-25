import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/storage/session.service';
import { createError } from './error-handler.middleware';

/**
 * Extracts and verifies the session authorization token.
 * Token can be passed via:
 * 1. 'X-Session-Token' HTTP header
 * 2. 'Authorization: Bearer <token>' HTTP header
 * 3. Cookie header ('session_token_{sessionId}' or 'session_token')
 */
export function requireSessionAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.params.sessionId;

  if (!sessionId) {
    return next(createError('Session ID is required', 400));
  }

  // Extract candidate token from headers or cookie
  let token: string | undefined;

  const xSessionToken = req.headers['x-session-token'];
  if (typeof xSessionToken === 'string' && xSessionToken.trim()) {
    token = xSessionToken.trim();
  }

  if (!token) {
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';');
    for (const cookie of cookies) {
      const [name, ...valParts] = cookie.trim().split('=');
      if (name === `session_token_${sessionId}` || name === 'session_token') {
        token = decodeURIComponent(valParts.join('='));
        break;
      }
    }
  }

  if (!token) {
    return next(
      createError(
        'Session access token is required. Please provide a valid Authorization or X-Session-Token header.',
        401
      )
    );
  }

  const isAuthorized = sessionService.verifySessionAccess(sessionId, token);
  if (!isAuthorized) {
    return next(createError('Unauthorized: Invalid or expired session credentials', 403));
  }

  next();
}
