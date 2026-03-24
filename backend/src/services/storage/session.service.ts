import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { SessionData } from '../../types/repository.types';
import config from '../../config/env.config';
import logger from '../../utils/logger.util';

export class SessionService {
  private sessions: Map<string, SessionData> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);

    // Ensure sessions directory exists
    this.ensureSessionsDirectory();
  }

  private async ensureSessionsDirectory(): Promise<void> {
    try {
      await fs.mkdir(config.sessionsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create sessions directory', { error });
    }
  }

  createSession(sessionData: Omit<SessionData, 'sessionId' | 'createdAt' | 'expiresAt'>): string {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.sessionTTL * 1000);

    const session: SessionData = {
      ...sessionData,
      sessionId,
      createdAt: now,
      expiresAt,
    };

    this.sessions.set(sessionId, session);

    logger.info('Session created', {
      sessionId,
      source: session.source,
      fileCount: session.files.size,
      expiresAt
    });

    return sessionId;
  }

  getSession(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      logger.warn('Session not found', { sessionId });
      return null;
    }

    if (new Date() > session.expiresAt) {
      logger.warn('Session expired', { sessionId });
      this.deleteSession(sessionId);
      return null;
    }

    return session;
  }

  getFileContent(sessionId: string, filePath: string): string | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const content = session.files.get(filePath);
    if (!content) {
      logger.warn('File not found in session', { sessionId, filePath });
      return null;
    }

    return content;
  }

  getAllFiles(sessionId: string): Map<string, string> | null {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    return session.files;
  }

  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.info('Session deleted', { sessionId });
    }
    return deleted;
  }

  extendSession(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }

    const expiresAt = new Date(Date.now() + config.sessionTTL * 1000);
    session.expiresAt = expiresAt;

    logger.debug('Session extended', { sessionId, expiresAt });
    return true;
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Expired sessions cleaned up', { count: cleanedCount });
    }
  }

  getActiveSessions(): number {
    return this.sessions.size;
  }

  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
    logger.info('Session service shut down');
  }
}

export const sessionService = new SessionService();
