import axios from 'axios';
import dns from 'dns';
import config from '../../config/env.config';
import logger from '../../utils/logger.util';
import { parseGitHubUrl } from './validation.service';
import { zipParserService } from './zip-parser.service';

// Ensure IPv4-first DNS resolution regardless of entrypoint (server.ts, Vercel, or unit tests)
try {
  dns.setDefaultResultOrder?.('ipv4first');
} catch {
  // Ignore on older Node runtimes
}

export class GitHubService {
  private apiBaseUrl = 'https://api.github.com';
  private codeloadBaseUrl = 'https://codeload.github.com';

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json, application/vnd.github.v3+json',
      'User-Agent': 'AI-Codebase-Explainer/2.0',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (config.githubToken) {
      // Modern GitHub API prefers Bearer tokens
      headers.Authorization =
        config.githubToken.startsWith('Bearer ') || config.githubToken.startsWith('token ')
          ? config.githubToken
          : `Bearer ${config.githubToken}`;
    }

    return headers;
  }

  private sanitizeLogMessage(message: string): string {
    return message
      .replace(/(?:Bearer|token)\s+[A-Za-z0-9_.-]+/gi, '[REDACTED_AUTH]')
      .replace(/(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]');
  }

  async fetchRepository(
    githubUrl: string,
    abortSignal?: AbortSignal,
    preferredBranch?: string
  ): Promise<Map<string, string>> {
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) {
      throw new Error('Invalid GitHub URL');
    }

    const { owner, repo } = parsed;
    logger.info('Fetching repository from GitHub via ZIP download', {
      owner,
      repo,
      hasToken: Boolean(config.githubToken),
    });

    try {
      let response;
      if (config.githubToken) {
        response = await this.withRetry(
          () => this.downloadZipViaApi(owner, repo, abortSignal),
          2,
          800,
          abortSignal
        );
      } else {
        try {
          response = await this.withRetry(
            () => this.downloadZipViaCodeload(owner, repo, abortSignal, preferredBranch),
            1,
            800,
            abortSignal
          );
        } catch (codeloadError: any) {
          if (abortSignal?.aborted || this.isAbortError(codeloadError)) {
            throw codeloadError;
          }

          // Fallback to api.github.com zipball (also handles repositories with custom default branch
          // or host-specific codeload routing/DNS blocks)
          logger.warn('Codeload archive fetch failed, falling back to GitHub API zipball', {
            owner,
            repo,
            code: codeloadError?.code,
            error: this.sanitizeLogMessage(
              codeloadError instanceof Error ? codeloadError.message : 'Unknown error'
            ),
          });
          response = await this.withRetry(
            () => this.downloadZipViaApi(owner, repo, abortSignal),
            2,
            800,
            abortSignal
          );
        }
      }

      logger.info('ZIP archive downloaded, extracting files', { owner, repo });

      // Parse the ZIP and extract files
      const files = await this.extractFilesFromZip(Buffer.from(response.data), abortSignal);

      logger.info('Repository fetched successfully', {
        owner,
        repo,
        fileCount: files.size,
      });

      return files;
    } catch (error: any) {
      logger.error('Error fetching repository from GitHub', {
        owner,
        repo,
        code: error?.code,
        status: error?.response?.status,
        error: this.sanitizeLogMessage(error instanceof Error ? error.message : 'Unknown error'),
      });

      throw this.formatGitHubError(error, owner, repo);
    }
  }

  private async downloadZipViaApi(owner: string, repo: string, abortSignal?: AbortSignal) {
    const zipUrl = `${this.apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball`;
    return axios.get(zipUrl, {
      headers: this.getHeaders(),
      responseType: 'arraybuffer',
      maxContentLength: config.maxFileSize,
      timeout: 60000,
      maxRedirects: 5,
      signal: abortSignal,
    });
  }

  private async downloadZipViaCodeload(
    owner: string,
    repo: string,
    abortSignal?: AbortSignal,
    preferredBranch?: string
  ) {
    const defaultCandidates = ['main', 'master', 'develop', 'trunk', 'dev'];
    const safePreferred =
      preferredBranch && /^[\w./-]+$/.test(preferredBranch) && !preferredBranch.includes('..')
        ? preferredBranch
        : undefined;
    const candidateBranches = safePreferred
      ? Array.from(new Set([safePreferred, ...defaultCandidates]))
      : defaultCandidates;

    let lastError: unknown = null;

    for (const branch of candidateBranches) {
      if (abortSignal?.aborted) {
        const cancelErr: any = new Error('Request aborted');
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }

      try {
        const encodedBranch = branch.split('/').map(encodeURIComponent).join('/');
        const zipUrl = `${this.codeloadBaseUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zip/refs/heads/${encodedBranch}`;

        logger.debug('Trying codeload branch archive', { owner, repo, branch });

        return await axios.get(zipUrl, {
          headers: {
            'User-Agent': 'AI-Codebase-Explainer/2.0',
            Accept: 'application/zip, application/octet-stream, */*',
          },
          responseType: 'arraybuffer',
          maxContentLength: config.maxFileSize,
          timeout: 45000,
          maxRedirects: 5,
          signal: abortSignal,
          validateStatus: (status) => status >= 200 && status < 400,
        });
      } catch (error: any) {
        lastError = error;
        // Break immediately on cancellation, DNS failure, TLS failure, or unreachable network
        // so retrying additional branch names does not multiply failing network roundtrips
        if (
          abortSignal?.aborted ||
          this.isAbortError(error) ||
          this.isDnsError(error) ||
          this.isTlsError(error) ||
          this.isConnectionError(error)
        ) {
          break;
        }
      }
    }

    throw lastError || new Error('Unable to download repository archive from codeload');
  }

  private isAbortError(error: any): boolean {
    if (!error) return false;
    return (
      axios.isCancel(error) ||
      error.name === 'AbortError' ||
      error.name === 'CanceledError' ||
      error.code === 'ERR_CANCELED'
    );
  }

  private isTransientDnsError(error: any): boolean {
    if (!error) return false;
    const code = error.code || error.cause?.code;
    const msg = error.message || '';
    return code === 'EAI_AGAIN' || msg.includes('getaddrinfo EAI_AGAIN');
  }

  private isPermanentDnsError(error: any): boolean {
    if (!error) return false;
    const code = error.code || error.cause?.code;
    const msg = error.message || '';
    return (
      code === 'ENOTFOUND' ||
      code === 'EAI_NONAME' ||
      msg.includes('getaddrinfo ENOTFOUND') ||
      msg.includes('getaddrinfo EAI_NONAME')
    );
  }

  private isDnsError(error: any): boolean {
    return this.isTransientDnsError(error) || this.isPermanentDnsError(error);
  }

  private isTlsError(error: any): boolean {
    if (!error) return false;
    const code = error.code || error.cause?.code || '';
    const msg = (error.message || '').toLowerCase();
    return (
      code === 'CERT_HAS_EXPIRED' ||
      code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
      code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
      code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
      code === 'ERR_TLS_HANDSHAKE_TIMEOUT' ||
      code === 'EPROTO' ||
      msg.includes('certificate') ||
      msg.includes('ssl') ||
      msg.includes('tls')
    );
  }

  private isConnectionError(error: any): boolean {
    if (!error) return false;
    const code = error.code || error.cause?.code || '';
    return (
      code === 'ECONNREFUSED' ||
      code === 'ENETUNREACH' ||
      code === 'EHOSTUNREACH' ||
      code === 'ECONNRESET' ||
      code === 'EPIPE' ||
      code === 'ERR_SOCKET_CLOSED'
    );
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 2,
    delayMs = 800,
    abortSignal?: AbortSignal
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      if (abortSignal?.aborted) {
        const cancelErr: any = new Error('Request aborted');
        cancelErr.name = 'AbortError';
        throw cancelErr;
      }

      try {
        return await fn();
      } catch (err: any) {
        if (abortSignal?.aborted || this.isAbortError(err)) {
          throw err;
        }

        attempt++;
        const isTransient =
          this.isTransientDnsError(err) ||
          err.code === 'ECONNRESET' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ECONNABORTED' ||
          err.code === 'EPIPE' ||
          (axios.isAxiosError(err) && err.response && err.response.status >= 500);

        if (attempt <= maxRetries && isTransient) {
          const waitMs = Math.min(delayMs * attempt, 3000);
          logger.warn(`Transient GitHub request failure on attempt ${attempt}, retrying in ${waitMs}ms...`, {
            code: err.code,
            error: this.sanitizeLogMessage(err.message || 'Unknown error'),
          });
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }
  }

  private formatGitHubError(error: unknown, owner: string, repo: string): Error {
    if (this.isAbortError(error)) {
      return new Error(`GitHub download for "${owner}/${repo}" was cancelled.`);
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const code = error.code || (error as any).cause?.code;
      const msg = error.message || '';

      // 1. DNS Resolution Errors
      if (this.isTransientDnsError(error)) {
        return new Error(
          'Temporary DNS lookup failure while reaching GitHub servers (EAI_AGAIN). Please try again in a moment.'
        );
      }

      if (this.isPermanentDnsError(error)) {
        return new Error(
          'Unable to reach GitHub servers (DNS lookup failed). Please check your internet connection or network proxy.'
        );
      }

      // 2. TLS / Certificate Errors
      if (this.isTlsError(error)) {
        return new Error(
          `Secure TLS connection to GitHub failed while fetching "${owner}/${repo}". Please verify network certificates or proxy settings.`
        );
      }

      // 3. Network Timeouts
      if (code === 'ECONNABORTED' || msg.includes('timeout') || code === 'ETIMEDOUT') {
        return new Error(
          `Connection to GitHub timed out while fetching repository "${owner}/${repo}". Please check your connection and try again.`
        );
      }

      // 4. Network Connection Resets / Unreachable / Refused
      if (code === 'ECONNRESET' || code === 'EPIPE') {
        return new Error(
          `Connection to GitHub was interrupted while downloading "${owner}/${repo}". Please try again.`
        );
      }

      if (code === 'ECONNREFUSED' || code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
        return new Error(
          `Unable to connect to GitHub servers (${code}). Please check your internet connection, firewall, or proxy.`
        );
      }

      // 5. Rate Limiting & Forbidden
      if (status === 403) {
        const remaining = error.response?.headers?.['x-ratelimit-remaining'];
        const resetTime = error.response?.headers?.['x-ratelimit-reset'];
        if (remaining === '0') {
          const resetDate = resetTime ? new Date(parseInt(resetTime, 10) * 1000).toLocaleTimeString() : 'soon';
          return new Error(
            `GitHub API rate limit exceeded (resets at ${resetDate}). Add a personal GITHUB_TOKEN in backend/.env to increase rate limits.`
          );
        }
        return new Error(
          `Access to GitHub repository "${owner}/${repo}" is forbidden. The repository may be private or restricted.`
        );
      }

      // 6. Authentication Failure
      if (status === 401) {
        return new Error(
          'GitHub authentication failed. Please verify that your GITHUB_TOKEN in backend/.env is valid.'
        );
      }

      // 7. Not Found
      if (status === 404) {
        return new Error(
          `Repository "${owner}/${repo}" was not found on GitHub. Please check that the repository URL is correct and public.`
        );
      }

      // 8. Payload / Size Limit
      if (status === 406 || code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED') {
        return new Error(
          `Repository "${owner}/${repo}" is too large to download directly as an archive. Please use the ZIP upload option.`
        );
      }
    }

    if (error instanceof Error) {
      if (this.isTransientDnsError(error)) {
        return new Error(
          'Temporary DNS lookup failure while reaching GitHub servers (EAI_AGAIN). Please try again in a moment.'
        );
      }
      if (this.isPermanentDnsError(error)) {
        return new Error(
          'Unable to reach GitHub servers (DNS lookup failed). Please check your internet connection or network proxy.'
        );
      }
      if (this.isTlsError(error)) {
        return new Error(
          `Secure TLS connection to GitHub failed while fetching "${owner}/${repo}". Please verify network certificates or proxy settings.`
        );
      }
      if (this.isConnectionError(error)) {
        return new Error(
          `Unable to connect to GitHub servers while downloading "${owner}/${repo}". Please check your network or proxy.`
        );
      }
      return new Error(this.sanitizeLogMessage(error.message));
    }

    return new Error('Failed to fetch repository: Unknown error');
  }

  private async extractFilesFromZip(buffer: Buffer, abortSignal?: AbortSignal): Promise<Map<string, string>> {
    return zipParserService.parseZipFile(buffer, abortSignal);
  }

  async checkRepositoryExists(githubUrl: string): Promise<boolean> {
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) {
      return false;
    }

    const { owner, repo } = parsed;
    const url = `${this.apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    try {
      await axios.get(url, { headers: this.getHeaders(), timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }
}

export const githubService = new GitHubService();
