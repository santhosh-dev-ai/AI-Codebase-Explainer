import { create } from 'zustand';
import type { ArchitectureOverview, Bug, Improvement } from '@/types/analysis.types';

interface AnalysisState {
  overview: ArchitectureOverview | null;
  currentExplanation: string | null;
  bugs: Bug[];
  improvements: Improvement[];
  flowDiagram: string | null;
  isLoading: Record<string, boolean>;

  // Actions
  setOverview: (overview: ArchitectureOverview) => void;
  setExplanation: (explanation: string) => void;
  setBugs: (bugs: Bug[]) => void;
  setImprovements: (improvements: Improvement[]) => void;
  setFlowDiagram: (diagram: string) => void;
  setLoadingState: (key: string, loading: boolean) => void;
  clearAnalysis: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  overview: null,
  currentExplanation: null,
  bugs: [],
  improvements: [],
  flowDiagram: null,
  isLoading: {},

  setOverview: (overview) => set({ overview }),

  setExplanation: (currentExplanation) => set({ currentExplanation }),

  setBugs: (bugs) => set({ bugs }),

  setImprovements: (improvements) => set({ improvements }),

  setFlowDiagram: (flowDiagram) => set({ flowDiagram }),

  setLoadingState: (key, loading) =>
    set((state) => ({
      isLoading: { ...state.isLoading, [key]: loading },
    })),

  clearAnalysis: () =>
    set({
      overview: null,
      currentExplanation: null,
      bugs: [],
      improvements: [],
      flowDiagram: null,
      isLoading: {},
    }),
}));
