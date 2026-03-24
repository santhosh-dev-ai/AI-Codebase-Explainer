'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { API_ENDPOINTS } from '@/constants/config';
import type { AnalyzeGitHubRequest, AnalyzeGitHubResponse } from '@/types/api.types';

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'github' | 'zip'>('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGitHubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await apiClient.post<AnalyzeGitHubResponse>(
        API_ENDPOINTS.ANALYZE_GITHUB,
        { githubUrl } as AnalyzeGitHubRequest
      );

      if (response.data) {
        router.push(`/analyze/${response.data.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze repository');
    } finally {
      setIsLoading(false);
    }
  };

  const handleZipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a ZIP file');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.uploadFile<AnalyzeGitHubResponse>(
        API_ENDPOINTS.UPLOAD_ZIP,
        formData
      );

      if (response.data) {
        router.push(`/analyze/${response.data.sessionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process ZIP file');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-text-primary mb-4">
            Codebase Explainer
          </h1>
          <p className="text-lg text-text-secondary">
            Understand any codebase instantly with AI-powered analysis
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-surface border border-border rounded-lg p-8">
          {/* Tabs */}
          <div className="flex gap-4 mb-6 border-b border-border">
            <button
              onClick={() => setActiveTab('github')}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === 'github'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              GitHub URL
            </button>
            <button
              onClick={() => setActiveTab('zip')}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === 'zip'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Upload ZIP
            </button>
          </div>

          {/* Forms */}
          {activeTab === 'github' ? (
            <form onSubmit={handleGitHubSubmit}>
              <div className="mb-6">
                <label htmlFor="githubUrl" className="block text-sm font-medium text-text-primary mb-2">
                  Repository URL
                </label>
                <input
                  type="text"
                  id="githubUrl"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className="w-full px-4 py-3 bg-background border border-border rounded-md text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
                  disabled={isLoading}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !githubUrl}
                className="w-full bg-accent hover:bg-opacity-90 text-white font-medium py-3 px-4 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Analyzing...' : 'Analyze Repository'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleZipSubmit}>
              <div className="mb-6">
                <label htmlFor="zipFile" className="block text-sm font-medium text-text-primary mb-2">
                  Upload ZIP File
                </label>
                <div className="border-2 border-dashed border-border rounded-md p-8 text-center">
                  <input
                    type="file"
                    id="zipFile"
                    accept=".zip"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="zipFile"
                    className="cursor-pointer inline-flex flex-col items-center"
                  >
                    <svg
                      className="w-12 h-12 text-text-secondary mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span className="text-text-primary font-medium">
                      {file ? file.name : 'Click to upload or drag and drop'}
                    </span>
                    <span className="text-text-secondary text-sm mt-1">
                      ZIP files only (max 50MB)
                    </span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !file}
                className="w-full bg-accent hover:bg-opacity-90 text-white font-medium py-3 px-4 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : 'Analyze Codebase'}
              </button>
            </form>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-error bg-opacity-10 border border-error rounded-md">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {/* Examples */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-text-secondary mb-3">Try with an example:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setGithubUrl('https://github.com/vercel/next.js')}
                className="text-sm px-3 py-1.5 bg-background border border-border rounded text-accent hover:bg-hover transition-colors"
                disabled={isLoading}
              >
                Next.js
              </button>
              <button
                onClick={() => setGithubUrl('https://github.com/facebook/react')}
                className="text-sm px-3 py-1.5 bg-background border border-border rounded text-accent hover:bg-hover transition-colors"
                disabled={isLoading}
              >
                React
              </button>
              <button
                onClick={() => setGithubUrl('https://github.com/microsoft/vscode')}
                className="text-sm px-3 py-1.5 bg-background border border-border rounded text-accent hover:bg-hover transition-colors"
                disabled={isLoading}
              >
                VS Code
              </button>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-semibold text-text-primary mb-2">Deep Analysis</h3>
            <p className="text-sm text-text-secondary">
              AI-powered architecture and flow analysis
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="font-semibold text-text-primary mb-2">Interactive Chat</h3>
            <p className="text-sm text-text-secondary">
              Ask questions about any part of the code
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-3">🐛</div>
            <h3 className="font-semibold text-text-primary mb-2">Bug Detection</h3>
            <p className="text-sm text-text-secondary">
              Identify potential issues and improvements
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
