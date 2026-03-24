import { create } from 'zustand';
import type { FileNode, RepoMetadata, FileContent } from '@/types/codebase.types';

interface CodebaseState {
  sessionId: string | null;
  fileTree: FileNode[];
  currentFile: FileContent | null;
  repoMetadata: RepoMetadata | null;
  isLoading: boolean;

  // Actions
  setSession: (sessionId: string) => void;
  setFileTree: (tree: FileNode[]) => void;
  setCurrentFile: (file: FileContent | null) => void;
  setRepoMetadata: (metadata: RepoMetadata) => void;
  setLoading: (loading: boolean) => void;
  clearCodebase: () => void;
}

export const useCodebaseStore = create<CodebaseState>((set) => ({
  sessionId: null,
  fileTree: [],
  currentFile: null,
  repoMetadata: null,
  isLoading: false,

  setSession: (sessionId) => set({ sessionId }),

  setFileTree: (fileTree) => set({ fileTree }),

  setCurrentFile: (currentFile) => set({ currentFile }),

  setRepoMetadata: (repoMetadata) => set({ repoMetadata }),

  setLoading: (isLoading) => set({ isLoading }),

  clearCodebase: () =>
    set({
      sessionId: null,
      fileTree: [],
      currentFile: null,
      repoMetadata: null,
      isLoading: false,
    }),
}));
