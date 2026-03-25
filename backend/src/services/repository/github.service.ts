import axios from 'axios';
import JSZip from 'jszip';
import config from '../../config/env.config';
import logger from '../../utils/logger.util';
import { parseGitHubUrl } from './validation.service';
import { shouldExcludeFile, shouldExcludeDirectory } from '../../utils/file-processor.util';

export class GitHubService {
  private apiBaseUrl = 'https://api.github.com';
  private codeloadBaseUrl = 'https://codeload.github.com';
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Codebase-Explainer',
    };

    if (config.githubToken) {
      this.headers.Authorization = `token ${config.githubToken}`;
    }
  }

  async fetchRepository(githubUrl: string): Promise<Map<string, string>> {
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
        response = await this.downloadZipViaApi(owner, repo);
      } else {
        try {
          response = await this.downloadZipViaCodeload(owner, repo);
        } catch (codeloadError) {
          logger.warn('Codeload branch guessing failed, falling back to GitHub API zipball', {
            owner,
            repo,
            error: codeloadError instanceof Error ? codeloadError.message : 'Unknown error',
          });
          response = await this.downloadZipViaApi(owner, repo);
        }
      }

      logger.info('ZIP archive downloaded, extracting files', { owner, repo });

      // Parse the ZIP and extract files
      const files = await this.extractFilesFromZip(Buffer.from(response.data));

      logger.info('Repository fetched successfully', {
        owner,
        repo,
        fileCount: files.size
      });

      return files;
    } catch (error) {
      logger.error('Error fetching repository from GitHub', {
        owner,
        repo,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('GitHub rate limit exceeded. Add GITHUB_TOKEN in backend/.env or try again later.');
        }
        if (error.response?.status === 404) {
          throw new Error('Repository not found or is private. Please check the URL.');
        }
        if (error.response?.status === 406) {
          throw new Error('Repository is too large to download.');
        }
      }

      throw new Error(`Failed to fetch repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async downloadZipViaApi(owner: string, repo: string) {
    const zipUrl = `${this.apiBaseUrl}/repos/${owner}/${repo}/zipball`;
    return axios.get(zipUrl, {
      headers: this.headers,
      responseType: 'arraybuffer',
      maxContentLength: config.maxFileSize,
      timeout: 120000,
    });
  }

  private async downloadZipViaCodeload(owner: string, repo: string) {
    const candidateBranches = ['main', 'master', 'develop', 'dev'];
    let lastError: unknown = null;

    for (const branch of candidateBranches) {
      try {
        const zipUrl = `${this.codeloadBaseUrl}/${owner}/${repo}/zip/refs/heads/${branch}`;

        logger.debug('Trying codeload branch archive', { owner, repo, branch });

        return await axios.get(zipUrl, {
          headers: {
            'User-Agent': 'Codebase-Explainer',
          },
          responseType: 'arraybuffer',
          maxContentLength: config.maxFileSize,
          timeout: 120000,
          validateStatus: (status) => status >= 200 && status < 400,
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Unable to download repository archive from codeload');
  }

  private async extractFilesFromZip(buffer: Buffer): Promise<Map<string, string>> {
    const zip = await JSZip.loadAsync(buffer);
    const files = new Map<string, string>();

    // GitHub ZIP archives have a top-level directory like "owner-repo-sha/"
    // We need to strip this prefix
    let prefix = '';
    for (const zipPath of Object.keys(zip.files)) {
      const parts = zipPath.split('/');
      if (parts.length >= 1) {
        prefix = parts[0] + '/';
        break;
      }
    }

    for (const [zipPath, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir) continue;

      // Strip the top-level directory prefix
      let relativePath = zipPath;
      if (prefix && zipPath.startsWith(prefix)) {
        relativePath = zipPath.substring(prefix.length);
      }

      if (!relativePath) continue;

      // Check directory exclusions
      const pathParts = relativePath.split('/');
      const shouldSkipDir = pathParts.slice(0, -1).some(part => shouldExcludeDirectory(part));
      if (shouldSkipDir) continue;

      // Check file exclusions
      const fileName = pathParts[pathParts.length - 1];
      if (shouldExcludeFile(fileName)) continue;

      try {
        // Try to read as text; skip binary files
        const content = await zipEntry.async('string');

        // Skip very large files (>500KB) and likely binary files
        if (content.length > 500000) continue;
        if (this.isBinaryContent(content)) continue;

        files.set(relativePath, content);
      } catch {
        // Skip files that can't be read as text (binary files)
        logger.debug('Skipping binary file', { path: relativePath });
      }
    }

    return files;
  }

  private isBinaryContent(content: string): boolean {
    // Check for null bytes which indicate binary content
    const sampleSize = Math.min(content.length, 8000);
    const sample = content.substring(0, sampleSize);

    let nullCount = 0;
    for (let i = 0; i < sample.length; i++) {
      if (sample.charCodeAt(i) === 0) {
        nullCount++;
        if (nullCount > 1) return true;
      }
    }
    return false;
  }

  async checkRepositoryExists(githubUrl: string): Promise<boolean> {
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) {
      return false;
    }

    const { owner, repo } = parsed;
    const url = `${this.apiBaseUrl}/repos/${owner}/${repo}`;

    try {
      await axios.get(url, { headers: this.headers });
      return true;
    } catch {
      return false;
    }
  }
}

export const githubService = new GitHubService();
