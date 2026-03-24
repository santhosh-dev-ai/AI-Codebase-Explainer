import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LOCAL_STORAGE_KEYS } from '@/constants/config';

type ActiveTab = 'overview' | 'explanation' | 'bugs' | 'flow';

interface UIState {
  sidebarWidth: number;
  rightPanelWidth: number;
  isChatOpen: boolean;
  activeTab: ActiveTab;
  theme: 'dark' | 'light';
  expandedFolders: Set<string>;

  // Actions
  setSidebarWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  toggleChat: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleFolder: (path: string) => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarWidth: 300,
      rightPanelWidth: 400,
      isChatOpen: false,
      activeTab: 'overview',
      theme: 'dark',
      expandedFolders: new Set<string>(),

      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),

      setRightPanelWidth: (rightPanelWidth) => set({ rightPanelWidth }),

      toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

      setActiveTab: (activeTab) => set({ activeTab }),

      setTheme: (theme) => set({ theme }),

      toggleFolder: (path) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          if (newExpanded.has(path)) {
            newExpanded.delete(path);
          } else {
            newExpanded.add(path);
          }
          return { expandedFolders: newExpanded };
        }),

      expandFolder: (path) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          newExpanded.add(path);
          return { expandedFolders: newExpanded };
        }),

      collapseFolder: (path) =>
        set((state) => {
          const newExpanded = new Set(state.expandedFolders);
          newExpanded.delete(path);
          return { expandedFolders: newExpanded };
        }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        rightPanelWidth: state.rightPanelWidth,
        theme: state.theme,
      }),
    }
  )
);
