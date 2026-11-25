import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { SessionData, SessionCreationResult } from '../../types/repository.types';
import config from '../../config/env.config';
import logger from '../../utils/logger.util';

export type SessionCleanupListener = (sessionId: string) => void;

export class SessionService {
  private sessions: Map<string, SessionData> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private cleanupListeners: Set<SessionCleanupListener> = new Set();
  private expiredCleanedTotal: number = 0;

  constructor() {
    // Clean up expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);

    // Ensure sessions directory exists
    this.ensureSessionsDirectory();
  }

  /**
   * Register a callback listener to be notified when a session is deleted or expired.
   * Returns an unsubscribe function.
   */
  public onSessionDeleted(listener: SessionCleanupListener): () => void {
    this.cleanupListeners.add(listener);
    return () => {
      this.cleanupListeners.delete(listener);
    };
  }

  private notifySessionDeleted(sessionId: string): void {
    for (const listener of this.cleanupListeners) {
      try {
        listener(sessionId);
      } catch (err) {
        logger.warn('Error in session cleanup listener', {
          sessionId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }

  private async ensureSessionsDirectory(): Promise<void> {
    try {
      await fs.mkdir(config.sessionsDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create sessions directory', { error });
    }
  }

  createSession(
    sessionData: Omit<SessionData, 'sessionId' | 'createdAt' | 'expiresAt' | 'tokenHash'>
  ): SessionCreationResult {
    // 1. Proactively clean up expired sessions before checking capacity
    this.cleanupExpiredSessions();

    // 2. Enforce active session capacity
    if (this.sessions.size >= config.maxActiveSessions) {
      logger.warn('Server session capacity reached', {
        current: this.sessions.size,
        maxCapacity: config.maxActiveSessions,
      });
      const error: any = new Error('Server session capacity reached. Please try again later.');
      error.statusCode = 503;
      throw error;
    }

    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.sessionTTL * 1000);

    // Generate cryptographically signed session token and hash
    const sessionToken = this.generateSessionToken(sessionId);
    const tokenHash = this.hashToken(sessionToken);

    const session: SessionData = {
      ...sessionData,
      sessionId,
      createdAt: now,
      expiresAt,
      tokenHash,
    };

    this.sessions.set(sessionId, session);
    void this.persistSession(session, true);

    logger.info('Session created', {
      sessionId,
      source: session.source,
      fileCount: session.files.size,
      expiresAt,
    });

    return { sessionId, sessionToken };
  }

  /**
   * Generates a tamper-proof HMAC-SHA256 signed session credential.
   */
  private generateSessionToken(sessionId: string): string {
    const randomEntropy = crypto.randomBytes(32).toString('hex');
    const payload = `${sessionId}:${Date.now()}:${randomEntropy}`;
    const signature = crypto
      .createHmac('sha256', config.sessionSecret)
      .update(payload)
      .digest('hex');
    const encodedPayload = Buffer.from(payload, 'utf8').toString('base64url');
    return `${encodedPayload}.${signature}`;
  }

  /**
   * Generates a one-way SHA-256 hash of a session token for storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Verifies that the provided token is authentic, unexpired, signed with the server secret,
   * bound to this exact sessionId, and matches the session's stored hash using constant-time comparison.
   */
  verifySessionAccess(sessionId: string, candidateToken?: string): boolean {
    if (!sessionId || !candidateToken || typeof candidateToken !== 'string') {
      return false;
    }

    const trimmed = candidateToken.trim();
    const dotIndex = trimmed.indexOf('.');
    if (dotIndex === -1) {
      return false;
    }

    const encodedPayload = trimmed.slice(0, dotIndex);
    const signature = trimmed.slice(dotIndex + 1);

    if (!encodedPayload || !signature) {
      return false;
    }

    let payloadStr: string;
    try {
      payloadStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    } catch {
      return false;
    }

    const parts = payloadStr.split(':');
    if (parts.length < 3) {
      return false;
    }

    const tokenSessionId = parts[0];
    if (tokenSessionId !== sessionId) {
      return false;
    }

    // 1. Verify HMAC signature with server secret
    const expectedSig = crypto
      .createHmac('sha256', config.sessionSecret)
      .update(payloadStr)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expectedSigBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedSigBuf.length || !crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
      return false;
    }

    // 2. Verify against active session record
    const session = this.getSession(sessionId);
    if (!session || !session.tokenHash) {
      return false;
    }

    const candidateHash = this.hashToken(trimmed);
    const storedHashBuf = Buffer.from(session.tokenHash, 'hex');
    const candidateHashBuf = Buffer.from(candidateHash, 'hex');

    if (
      storedHashBuf.length !== candidateHashBuf.length ||
      !crypto.timingSafeEqual(storedHashBuf, candidateHashBuf)
    ) {
      return false;
    }

    return true;
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

  /**
   * Invalidates cached overview on all active sessions matching the given fingerprint,
   * or all active sessions if no fingerprint is provided.
   */
  invalidateSessionOverviews(fingerprint?: string): void {
    for (const session of this.sessions.values()) {
      if (!fingerprint || session.cachedOverviewFingerprint === fingerprint) {
        delete session.cachedOverview;
        delete session.cachedOverviewFingerprint;
        delete session.cachedOverviewEngineVersion;
      }
    }
  }

  resolveFilePath(sessionId: string, filePath: string): string | null {
    const session = this.getSession(sessionId);
    if (!session || !filePath) {
      return null;
    }

    if (session.files.has(filePath)) {
      return filePath;
    }

    const normalized = filePath.replace(/\\/g, '/').replace(/^\.?\//, '').trim();
    if (session.files.has(normalized)) {
      return normalized;
    }

    const withoutLeading = normalized.replace(/^\/+/, '');
    if (session.files.has(withoutLeading)) {
      return withoutLeading;
    }

    const lowerTarget = withoutLeading.toLowerCase();
    for (const key of session.files.keys()) {
      const keyNorm = key.replace(/\\/g, '/').replace(/^\/+/, '');
      if (keyNorm === withoutLeading || keyNorm.toLowerCase() === lowerTarget) {
        return key;
      }
      if (keyNorm.endsWith('/' + withoutLeading) || withoutLeading.endsWith('/' + keyNorm)) {
        return key;
      }
    }

    return null;
  }

  hasFile(sessionId: string, filePath: string): boolean {
    return this.resolveFilePath(sessionId, filePath) !== null;
  }

  getFileContent(sessionId: string, filePath: string): string | null {
    const session = this.getSession(sessionId);
    if (!session || !filePath) {
      return null;
    }

    const actualPath = this.resolveFilePath(sessionId, filePath);
    if (!actualPath) {
      logger.warn('File not found in session', { sessionId, filePath });
      return null;
    }

    const content = session.files.get(actualPath);
    if (content === undefined) {
      logger.warn('File content undefined in session', { sessionId, filePath, actualPath });
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
    this.deleteSessionFile(sessionId);
    this.notifySessionDeleted(sessionId);
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
    // Only update metadata; files are immutable and already persisted
    void this.persistSession(session, false);

    logger.debug('Session extended', { sessionId, expiresAt });
    return true;
  }

  public cleanupExpiredSessions(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        this.deleteSessionFile(sessionId);
        this.notifySessionDeleted(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.expiredCleanedTotal += cleanedCount;
      logger.info('Expired sessions cleaned up', { count: cleanedCount, totalCleaned: this.expiredCleanedTotal });
    }

    return cleanedCount;
  }

  getActiveSessions(): number {
    return this.sessions.size;
  }

  getSessionMetrics(): { activeSessions: number; maxCapacity: number; expiredCleanedTotal: number } {
    return {
      activeSessions: this.sessions.size,
      maxCapacity: config.maxActiveSessions,
      expiredCleanedTotal: this.expiredCleanedTotal,
    };
  }

  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
    logger.info('Session service shut down');
  }

  private getSessionDir(sessionId: string): string {
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(config.sessionsDir, safeId);
  }

  private getLegacySessionFilePath(sessionId: string): string {
    const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(config.sessionsDir, `${safeId}.json`);
  }

  private async persistSession(session: SessionData, persistFiles: boolean = true): Promise<void> {
    const sessionDir = this.getSessionDir(session.sessionId);
    try {
      await fs.mkdir(sessionDir, { recursive: true });

      // 1. Persist files.json atomically (only on creation or content update)
      if (persistFiles) {
        const filesPayload = JSON.stringify(Array.from(session.files.entries()));
        const tmpFilesPath = path.join(
          sessionDir,
          `.files.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`
        );
        await fs.writeFile(tmpFilesPath, filesPayload, 'utf8');
        await fs.rename(tmpFilesPath, path.join(sessionDir, 'files.json'));
      }

      // 2. Persist meta.json atomically (lightweight metadata)
      const metaPayload = {
        sessionId: session.sessionId,
        source: session.source,
        sourceUrl: session.sourceUrl,
        branch: session.branch,
        commitSha: session.commitSha,
        contentHash: session.contentHash,
        rawManifestHash: session.rawManifestHash,
        tokenHash: session.tokenHash,
        fileTree: session.fileTree,
        metadata: session.metadata,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      };
      const tmpMetaPath = path.join(
        sessionDir,
        `.meta.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`
      );
      await fs.writeFile(tmpMetaPath, JSON.stringify(metaPayload), 'utf8');
      await fs.rename(tmpMetaPath, path.join(sessionDir, 'meta.json'));
    } catch (error) {
      logger.warn('Failed to persist session to disk', {
        sessionId: session.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private loadSessionFromDisk(sessionId: string): SessionData | null {
    const sessionDir = this.getSessionDir(sessionId);
    const metaPath = path.join(sessionDir, 'meta.json');
    const filesPath = path.join(sessionDir, 'files.json');

    // 1. Preferred modern format: Directory containing meta.json and files.json
    try {
      if (fsSync.existsSync(metaPath) && fsSync.existsSync(filesPath)) {
        const metaRaw = fsSync.readFileSync(metaPath, 'utf8');
        const filesRaw = fsSync.readFileSync(filesPath, 'utf8');

        const metaParsed = JSON.parse(metaRaw);
        const filesEntries = JSON.parse(filesRaw) as Array<[string, string]>;

        return {
          sessionId: metaParsed.sessionId,
          source: metaParsed.source,
          sourceUrl: metaParsed.sourceUrl,
          branch: metaParsed.branch,
          commitSha: metaParsed.commitSha,
          contentHash: metaParsed.contentHash,
          rawManifestHash: metaParsed.rawManifestHash,
          tokenHash: metaParsed.tokenHash,
          fileTree: metaParsed.fileTree,
          metadata: metaParsed.metadata,
          files: new Map(filesEntries || []),
          createdAt: new Date(metaParsed.createdAt),
          expiresAt: new Date(metaParsed.expiresAt),
        };
      }
    } catch (error) {
      logger.warn('Failed to load modern session from disk', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 2. Legacy fallback format: single ${sessionId}.json file (Backward Compatibility & Migration)
    try {
      const legacyPath = this.getLegacySessionFilePath(sessionId);
      if (fsSync.existsSync(legacyPath)) {
        const raw = fsSync.readFileSync(legacyPath, 'utf8');
        const parsed = JSON.parse(raw);

        const loadedSession: SessionData = {
          ...parsed,
          files: new Map(parsed.files || []),
          createdAt: new Date(parsed.createdAt),
          expiresAt: new Date(parsed.expiresAt),
        };

        // Smoothly migrate legacy session to modern directory format and delete legacy file
        void this.persistSession(loadedSession, true).then(() => {
          fs.unlink(legacyPath).catch(() => {});
        });

        return loadedSession;
      }
    } catch (error) {
      logger.warn('Failed to load legacy session from disk', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return null;
  }

  private deleteSessionFile(sessionId: string): void {
    const sessionDir = this.getSessionDir(sessionId);
    const legacyPath = this.getLegacySessionFilePath(sessionId);

    // Remove modern session directory recursively
    fs.rm(sessionDir, { recursive: true, force: true }).catch(() => {
      // Ignore cleanup race conditions
    });

    // Remove legacy single-file session if present
    fs.unlink(legacyPath).catch(() => {
      // Ignore cleanup race conditions
    });
  }
}

export const sessionService = new SessionService();
