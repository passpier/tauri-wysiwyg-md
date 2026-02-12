import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  autoSave: boolean;
  autoSaveInterval: number; // in milliseconds
  spellCheck: boolean;
  wordWrap: boolean;
  showLineNumbers: boolean;
  language: string;
  // Actions
  updateSettings: (settings: Partial<Omit<SettingsState, 'updateSettings'>>) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoSave: true,
      autoSaveInterval: 5000,
      spellCheck: true,
      wordWrap: true,
      showLineNumbers: false,
      language: 'en',

      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),

      setAutoSave: (enabled) => set({ autoSave: enabled }),

      setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),
    }),
    {
      name: 'editor-settings',
    }
  )
);
