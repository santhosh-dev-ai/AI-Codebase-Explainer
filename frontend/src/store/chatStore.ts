import { create } from 'zustand';
import type { ChatMessage } from '@/types/chat.types';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamingMessage: string;

  // Actions
  addMessage: (message: ChatMessage) => void;
  setStreaming: (isStreaming: boolean) => void;
  appendToStreamingMessage: (text: string) => void;
  clearStreamingMessage: () => void;
  clearHistory: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  currentStreamingMessage: '',

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  appendToStreamingMessage: (text) =>
    set((state) => ({
      currentStreamingMessage: state.currentStreamingMessage + text,
    })),

  clearStreamingMessage: () => set({ currentStreamingMessage: '' }),

  clearHistory: () => set({ messages: [], currentStreamingMessage: '' }),
}));
