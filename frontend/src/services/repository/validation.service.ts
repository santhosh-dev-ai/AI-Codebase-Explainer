import logger from '../../utils/logger.util';

const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
const GITHUB_REPO_REGEX = /github\.com\/([\w-]+)\/([\w.-]+)/;

export function isValidGitHubUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      (urlObj.hostname === 'github.com' || urlObj.hostname === 'www.github.com') &&
      GITHUB_URL_REGEX.test(url.replace(/\.git$/, ''))
    );
  } catch {
    return false;
  }
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(GITHUB_REPO_REGEX);
  if (!match) {
    logger.error('Invalid GitHub URL format', { url });
    return null;
  }

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  };
}

export function isValidZipFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.zip');
}

export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

export function sanitizePath(filePath: string): string {
  // Remove any potentially dangerous path traversal attempts
  return filePath.replace(/\.\./g, '').replace(/[<>:"|?*]/g, '_');
}
