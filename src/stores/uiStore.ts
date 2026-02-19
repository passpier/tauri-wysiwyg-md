import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { ThemeName, THEME_NAMES } from '@/theme/types';
import { applyTheme } from '@/theme/utils';

interface UIState {
  currentTheme: ThemeName;
  sidebarVisible: boolean;
  fontSize: number;
  fontFamily: string;
  sidebarWidth: number;
  osPlatform: 'macos' | 'windows' | 'gnome' | null;
  editorMode: 'wysiwyg' | 'source';
  sidebarTab: 'files' | 'search';
  findBarVisible: boolean;
  // Actions
  setCurrentTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setSidebarWidth: (width: number) => void;
  setOsPlatform: (platform: 'macos' | 'windows' | 'gnome') => void;
  setEditorMode: (mode: 'wysiwyg' | 'source') => void;
  toggleEditorMode: () => void;
  initializeTheme: () => void;
  setSidebarTab: (tab: 'files' | 'search') => void;
  setFindBarVisible: (visible: boolean) => void;
  toggleFindBar: () => void;
}

type PersistedUIState = Pick<UIState, 'currentTheme' | 'sidebarVisible' | 'fontSize' | 'fontFamily' | 'sidebarWidth' | 'editorMode' | 'sidebarTab'>;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      currentTheme: 'github-light',
      sidebarVisible: false,
      fontSize: 16,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      sidebarWidth: 280,
      editorMode: 'wysiwyg',
      sidebarTab: 'files',
      findBarVisible: false,
      osPlatform: (() => {
        if (typeof navigator !== 'undefined') {
          if (navigator.userAgent.includes('Macintosh')) return 'macos';
          if (navigator.userAgent.includes('Windows')) return 'windows';
          if (navigator.userAgent.includes('Linux')) return 'gnome';
        }
        return null;
      })(),

      setCurrentTheme: (theme: ThemeName) => {
        if (THEME_NAMES[theme]) {
          applyTheme(theme);
          set({ currentTheme: theme });
        }
      },

      toggleTheme: () => {
        const currentTheme = get().currentTheme;
        const currentDefinition = THEME_NAMES[currentTheme];
        
        // Switch to dark if light, or cycle through themes
        if (currentDefinition.variant === 'light') {
          // Find first dark variant
          const darkTheme = Object.keys(THEME_NAMES).find(
            (t) => THEME_NAMES[t as ThemeName].variant === 'dark'
          ) as ThemeName | undefined;
          if (darkTheme) {
            get().setCurrentTheme(darkTheme);
            return;
          }
        } else {
          // Find first light variant
          const lightTheme = Object.keys(THEME_NAMES).find(
            (t) => THEME_NAMES[t as ThemeName].variant === 'light'
          ) as ThemeName | undefined;
          if (lightTheme) {
            get().setCurrentTheme(lightTheme);
            return;
          }
        }
      },

      toggleSidebar: () =>
        set((state) => ({
          sidebarVisible: !state.sidebarVisible,
        })),

      setSidebarVisible: (visible) => set({ sidebarVisible: visible }),

      setFontSize: (size) => set({ fontSize: size }),

      setFontFamily: (family) => set({ fontFamily: family }),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      setOsPlatform: (platform: 'macos' | 'windows' | 'gnome') =>
        set({ osPlatform: platform }),

      setEditorMode: (mode) => set({ editorMode: mode }),

      toggleEditorMode: () =>
        set((state) => ({
          editorMode: state.editorMode === 'wysiwyg' ? 'source' : 'wysiwyg',
        })),

      initializeTheme: () => {
        const state = get();
        applyTheme(state.currentTheme);
      },

      setSidebarTab: (tab) => set({ sidebarTab: tab }),

      setFindBarVisible: (visible) => set({ findBarVisible: visible }),

      toggleFindBar: () =>
        set((state) => ({ findBarVisible: !state.findBarVisible })),
    }),
    {
      name: 'ui-preferences',
      partialize: (state): PersistedUIState => ({
        currentTheme: state.currentTheme,
        sidebarVisible: state.sidebarVisible,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        sidebarWidth: state.sidebarWidth,
        editorMode: state.editorMode,
        sidebarTab: state.sidebarTab,
        // osPlatform and findBarVisible are excluded from persistence
      }),
      onRehydrate: (state: unknown) => {
        // Apply theme after hydration from localStorage
        if (state && typeof state === 'object' && 'currentTheme' in state) {
          const uiState = state as Partial<UIState>;
          if (uiState.currentTheme) {
            applyTheme(uiState.currentTheme);
          }
        }
      },
    } as PersistOptions<UIState, PersistedUIState>
  )
);
