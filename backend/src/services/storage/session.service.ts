import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import fsSync from 'fs';
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
    void this.persistSession(session);

    logger.info('Session created', {
      sessionId,
      source: session.source,
      fileCount: session.files.size,
      expiresAt
    });

    return sessionId;
  }

  getSession(sessionId: string): SessionData | null {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = this.loadSessionFromDisk(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    }

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
      this.deleteSessionFile(sessionId);
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
    void this.persistSession(session);

    logger.debug('Session extended', { sessionId, expiresAt });
    return true;
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        this.deleteSessionFile(sessionId);
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

  private getSessionFilePath(sessionId: string): string {
    return path.join(config.sessionsDir, `${sessionId}.json`);
  }

  private async persistSession(session: SessionData): Promise<void> {
    try {
      const payload = {
        ...session,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        files: Array.from(session.files.entries()),
      };

      await fs.writeFile(
        this.getSessionFilePath(session.sessionId),
        JSON.stringify(payload),
        'utf8'
      );
    } catch (error) {
      logger.warn('Failed to persist session to disk', {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private loadSessionFromDisk(sessionId: string): SessionData | null {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      if (!fsSync.existsSync(filePath)) {
        return null;
      }

      const raw = fsSync.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as Omit<SessionData, 'files' | 'createdAt' | 'expiresAt'> & {
        files: Array<[string, string]>;
        createdAt: string;
        expiresAt: string;
      };

      return {
        ...parsed,
        files: new Map(parsed.files || []),
        createdAt: new Date(parsed.createdAt),
        expiresAt: new Date(parsed.expiresAt),
      };
    } catch (error) {
      logger.warn('Failed to load session from disk', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private deleteSessionFile(sessionId: string): void {
    const filePath = this.getSessionFilePath(sessionId);
    fs.unlink(filePath).catch(() => {
      // Ignore cleanup race conditions.
    });
  }
}

export const sessionService = new SessionService();
