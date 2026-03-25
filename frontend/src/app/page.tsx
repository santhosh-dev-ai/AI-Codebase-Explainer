'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchCode, MessageSquareText, ShieldAlert } from 'lucide-react';
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
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="min-h-screen flex items-center justify-center bg-background premium-bg p-4 relative overflow-hidden"
    >
      <div className="premium-grid" />
      <div className="w-full max-w-2xl relative z-10">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center mb-12"
        >
          <div className="inline-block mb-4">
            <motion.span 
              className="inline-flex items-center px-4 py-2 rounded-2xl border border-blue-500/30 bg-blue-500/8 backdrop-blur-md"
              animate={{ borderColor: ['rgba(58, 134, 255, 0.3)', 'rgba(58, 134, 255, 0.6)', 'rgba(58, 134, 255, 0.3)'] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <span className="text-xs font-semibold tracking-wide text-blue-300">AI-POWERED ANALYSIS</span>
            </motion.span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-blue-100 to-cyan-300">
            Codebase Explainer
          </h1>
          <p className="text-xl text-zinc-300 max-w-xl mx-auto leading-relaxed">
            Understand any codebase instantly with AI-powered analysis and interactive dashboards
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-panel-strong rounded-3xl p-8 border border-blue-500/20 shadow-[0_20px_60px_rgba(58,134,255,0.1)]"
        >
          {/* Tabs */}
          <div className="flex gap-1 mb-8 bg-zinc-950/30 p-1 rounded-xl border border-zinc-800/50">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab('github')}
              className={`flex-1 py-2.5 px-4 font-medium rounded-lg transition-all duration-300 ${
                activeTab === 'github'
                  ? 'bg-gradient-to-r from-blue-600/40 to-cyan-600/30 text-blue-200 shadow-[0_0_20px_rgba(58,134,255,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              GitHub URL
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab('zip')}
              className={`flex-1 py-2.5 px-4 font-medium rounded-lg transition-all duration-300 ${
                activeTab === 'zip'
                  ? 'bg-gradient-to-r from-blue-600/40 to-cyan-600/30 text-blue-200 shadow-[0_0_20px_rgba(58,134,255,0.2)]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Upload ZIP
            </motion.button>
          </div>

          {/* Forms */}
          <AnimatePresence mode="wait">
          {activeTab === 'github' ? (
            <motion.form
              key="github-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleGitHubSubmit}
            >
              <div className="mb-6">
                <label htmlFor="githubUrl" className="block text-sm font-semibold text-zinc-200 mb-3 tracking-wide">
                  Repository URL
                </label>
                <motion.input
                  whileFocus={{ scale: 1.01 }}
                  type="text"
                  id="githubUrl"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className="gh-input w-full border border-blue-500/20 focus:border-blue-500/60"
                  disabled={isLoading}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isLoading || !githubUrl}
                className="w-full gh-button relative overflow-hidden font-semibold py-3 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0 shadow-[0_12px_32px_rgba(58,134,255,0.2)]"
              >
                <motion.span
                  animate={{ opacity: [1, 0.8, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative z-10"
                >
                  {isLoading ? 'Analyzing Repository...' : 'Analyze Repository'}
                </motion.span>
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="zip-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleZipSubmit}
            >
              <div className="mb-6">
                <label htmlFor="zipFile" className="block text-sm font-semibold text-zinc-200 mb-3 tracking-wide">
                  Upload ZIP File
                </label>
                <div className="border-2 border-dashed border-blue-500/30 rounded-2xl p-8 text-center bg-gradient-to-b from-blue-500/5 to-cyan-500/5 hover:border-blue-500/60 transition-all duration-300">
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
                    <motion.svg
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-14 h-14 text-blue-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </motion.svg>
                    <span className="text-zinc-100 font-semibold">
                      {file ? file.name : 'Click to upload or drag and drop'}
                    </span>
                    <span className="text-zinc-400 text-sm mt-1">
                      ZIP files only (max 50MB)
                    </span>
                  </label>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={isLoading || !file}
                className="w-full gh-button relative overflow-hidden font-semibold py-3 px-4 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0 shadow-[0_12px_32px_rgba(58,134,255,0.2)]"
              >
                <motion.span
                  animate={{ opacity: [1, 0.8, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative z-10"
                >
                  {isLoading ? 'Processing ZIP...' : 'Analyze Codebase'}
                </motion.span>
              </motion.button>
            </motion.form>
          )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 bg-red-500/10 border border-red-500/40 rounded-xl backdrop-blur-sm"
              >
                <p className="text-red-300 text-sm font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Features */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            { 
              icon: SearchCode, 
              title: 'Deep Analysis', 
              desc: 'AI-powered architecture and flow analysis'
            },
            { 
              icon: MessageSquareText, 
              title: 'Interactive Chat', 
              desc: 'Ask questions about any part of the code'
            },
            { 
              icon: ShieldAlert, 
              title: 'Bug Detection', 
              desc: 'Identify potential issues and improvements'
            }
          ].map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + idx * 0.1, duration: 0.4 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="text-center premium-card rounded-2xl p-7 border border-blue-500/20 hover:border-blue-500/40 shadow-[0_8px_24px_rgba(58,134,255,0.08)]"
              >
                <motion.div 
                  className="w-14 h-14 rounded-2xl mx-auto mb-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/30 flex items-center justify-center"
                  whileHover={{ scale: 1.1, boxShadow: '0 0 20px rgba(58, 134, 255, 0.3)' }}
                >
                  <Icon className="w-6 h-6 text-blue-300" />
                </motion.div>
                <h3 className="font-semibold text-zinc-100 mb-2 text-lg">{feature.title}</h3>
                <p className="text-sm text-zinc-400">
                  {feature.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}
