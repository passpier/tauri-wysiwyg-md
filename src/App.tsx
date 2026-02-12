import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { WindowTitlebar } from 'tauri-controls';
import { Editor } from '@/components/Editor/Editor';
import { SourceEditor } from '@/components/Editor/SourceEditor';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { ThemeSelector } from '@/components/ThemeSelector';
import { useDocumentStore } from '@/stores/documentStore';
import { useUIStore } from '@/stores/uiStore';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { usePlatformInitialization } from '@/hooks/usePlatformInitialization';
import { getPrimaryLanguageCode } from '@/i18n/languageUtils';
import {
  FileText,
  PanelLeft,
} from 'lucide-react';

function App() {
  const { t, i18n } = useTranslation();
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const saveDocument = useDocumentStore((state) => state.saveDocument);
  const closeDocument = useDocumentStore((state) => state.closeDocument);
  const updateContent = useDocumentStore((state) => state.updateContent);
  const createNewDocument = useDocumentStore((state) => state.createNewDocument);
  const loadDocument = useDocumentStore((state) => state.loadDocument);
  
  const initializeTheme = useUIStore((state) => state.initializeTheme);
  const sidebarVisible = useUIStore((state) => state.sidebarVisible);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const editorMode = useUIStore((state) => state.editorMode);
  const toggleEditorMode = useUIStore((state) => state.toggleEditorMode);
  const osPlatform = useUIStore((state) => state.osPlatform);
  const language = useSettingsStore((state) => state.language);
  const hasInitializedDocument = useRef(false);
  const editor = useEditorStore((state) => state.editor);
  const menuUnlistenersRef = useRef<Array<() => void>>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize platform detection early (before first render ideally)
  usePlatformInitialization();

  // Initialize auto-save
  useAutoSave();

  const activeDocument = documents.find(d => d.id === activeDocumentId);

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  // Sync language with i18n and Rust backend
  // Ensures consistent language code format (always 'en' or 'zh', never 'en-US', 'zh-TW', etc.)
  // Note: Native menu language is handled directly in Rust event handler
  useEffect(() => {
    if (language) {
      const normalizedLang = getPrimaryLanguageCode(language);
      void i18n.changeLanguage(normalizedLang);
      // Sync with backend state
      void invoke('set_language', { lang: normalizedLang });
    }
  }, [language, i18n]);

  // Sync editor mode to native menu
  useEffect(() => {
    void invoke('update_menu_item_state', {
      id: 'view_source_code',
      checked: editorMode === 'source',
    });
  }, [editorMode]);

  // Load any pending files requested by the OS (file association) and listen for new ones.
  useEffect(() => {
    let isActive = true;
    let unlisten: (() => void) | undefined;

    const setupFileHandling = async () => {
      try {
        // 1. First set up the listener for future events (e.g. via single-instance)
        const stop = await listen<string>('open-file', (event) => {
          if (event.payload) {
            console.log('📬 Received open-file event:', event.payload);
            void loadDocument(event.payload);
          }
        });
        
        if (!isActive) {
          stop();
          return;
        }
        unlisten = stop;

        // 2. Then check for any files that arrived during startup
        const pending = await invoke<string[]>('take_pending_open_files');
        if (!isActive) return;

        if (pending.length > 0) {
          console.log('📥 Loading pending files:', pending);
          await Promise.all(
            pending.map(async (path) => {
              try {
                await loadDocument(path);
              } catch (error) {
                console.warn('Failed to load pending file:', path, error);
              }
            })
          );
        }
      } catch (error) {
        console.warn('Failed to setup file handling:', error);
      }
    };

    void setupFileHandling();

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, [loadDocument]);


  const getDocumentTitle = () => {
    if (!activeDocument) return t('common.markdown_editor');

    const fileName = activeDocument.path
      ? activeDocument.path.split('/').pop() ?? t('common.untitled')
      : t('common.untitled');
    const editedSuffix = activeDocument.isDirty ? ` • ${t('common.edited')}` : '';

    return `${fileName}${editedSuffix} - ${t('common.markdown_editor')}`;
  };

  useEffect(() => {
    try {
      const currentWindow = getCurrentWindow();
      const title = getDocumentTitle();
      document.title = title;
      void currentWindow.setTitle(title);
    } catch (error) {
      console.warn('Failed to update window title:', error);
    }
  }, [activeDocument?.path, activeDocument?.isDirty]);

  useEffect(() => {
    let isActive = true;
    let unlistenResize: (() => void) | undefined;
    const currentWindow = getCurrentWindow();

    const syncFullscreenState = async () => {
      try {
        const fullscreen = await currentWindow.isFullscreen();
        if (isActive) {
          setIsFullscreen(fullscreen);
        }
      } catch (error) {
        console.warn('Failed to read fullscreen state:', error);
      }
    };

    void syncFullscreenState();

    currentWindow
      .onResized(() => {
        void syncFullscreenState();
      })
      .then((unlisten) => {
        if (!isActive) {
          unlisten();
          return;
        }
        unlistenResize = unlisten;
      })
      .catch((error) => {
        console.warn('Failed to listen for resize events:', error);
      });

    return () => {
      isActive = false;
      unlistenResize?.();
    };
  }, []);

  const documentTitle = (() => {
    if (!activeDocument) return t('common.markdown_editor');
    return activeDocument.path
      ? activeDocument.path.split('/').pop() ?? t('common.untitled')
      : t('common.untitled');
  })();

  // Ensure a blank document exists for first launch
  useEffect(() => {
    if (!hasInitializedDocument.current && documents.length === 0 && !activeDocumentId) {
      createNewDocument();
      hasInitializedDocument.current = true;

    }
  }, [documents.length, activeDocumentId, createNewDocument]);

  const handleOpenFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Markdown',
            extensions: ['md', 'markdown'],
          },
        ],
      });

      const filePath = Array.isArray(selected) ? selected[0] : selected;
      if (filePath && typeof filePath === 'string') {
        await loadDocument(filePath);
      }
    } catch (error) {
      console.error('Open file failed:', error);
    }
  };

  const handleSaveAs = async () => {
    if (!activeDocumentId || !activeDocument) return;

    try {
      const filePath = await save({
        defaultPath: 'untitled.md',
        filters: [{
          name: 'Markdown',
          extensions: ['md', 'markdown']
        }]
      });

      if (filePath) {
        // Update document with new path
        updateContent(activeDocumentId, activeDocument.content);
        const doc = { ...activeDocument, path: filePath };
        useDocumentStore.setState((state) => ({
          documents: state.documents.map(d =>
            d.id === activeDocumentId ? doc : d
          )
        }));
        await saveDocument(activeDocumentId);
      }
    } catch (error) {
      console.error('Save as failed:', error);
    }
  };

  const handleManualSave = async () => {
    if (!activeDocumentId || !activeDocument) return;

    if (activeDocument.path) {
      try {
        await saveDocument(activeDocumentId);
      } catch (error) {
        console.error('Save failed:', error);
      }
    } else {
      handleSaveAs();
    }
  };

  const runEditorCommand = (payload: { command: string; level?: number }) => {
    if (!editor) return;

    const chain = editor.chain().focus();
    switch (payload.command) {
      case 'bold':
        chain.toggleBold().run();
        break;
      case 'italic':
        chain.toggleItalic().run();
        break;
      case 'strike':
        chain.toggleStrike().run();
        break;
      case 'inline_code':
        chain.toggleCode().run();
        break;
      case 'paragraph':
        chain.setParagraph().run();
        break;
      case 'heading':
        if (payload.level) {
          chain.toggleHeading({ level: payload.level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
        }
        break;
      case 'bullet_list':
        chain.toggleBulletList().run();
        break;
      case 'ordered_list':
        chain.toggleOrderedList().run();
        break;
      case 'blockquote':
        chain.toggleBlockquote().run();
        break;
      case 'code_block':
        chain.toggleCodeBlock().run();
        break;
      case 'horizontal_rule':
        chain.setHorizontalRule().run();
        break;
      case 'undo':
        editor.commands.undo();
        break;
      case 'redo':
        editor.commands.redo();
        break;
      default:
        break;
    }
  };

  // Native menu events
  useEffect(() => {
    let isActive = true;

    const setupListeners = async () => {
      try {
        const listeners = await Promise.all([
          listen('menu-new-file', () => {
            createNewDocument();
          }),
          listen('menu-open-file', () => {
            void handleOpenFile();
          }),
          listen('menu-save-file', () => {
            void handleManualSave();
          }),
          listen('menu-save-as', () => {
            void handleSaveAs();
          }),
          listen('menu-close-document', () => {
            if (activeDocumentId) {
              closeDocument(activeDocumentId);
            }
          }),
          listen('menu-toggle-sidebar', () => {
            toggleSidebar();
          }),
          listen('menu-toggle-editor-mode', () => {
            toggleEditorMode();
          }),
          listen<string>('menu-set-theme', (event) => {
            const themeName = event.payload as any;
            const setCurrentTheme = useUIStore.getState().setCurrentTheme;
            setCurrentTheme(themeName);
          }),
          listen<string>('language-changed', (event) => {
            console.log('📢 Backend notified of language change:', event.payload);
            const updateSettings = useSettingsStore.getState().updateSettings;
            updateSettings({ language: event.payload });
            console.log('✅ Frontend store updated to:', event.payload);
          }),
          listen<{ command: string; level?: number }>(
            'menu-editor-command',
            (event) => {
              runEditorCommand(event.payload);
            }
          ),
        ]);

        if (!isActive) {
          listeners.forEach((unlisten) => unlisten());
          return;
        }

        menuUnlistenersRef.current = listeners;
      } catch (error) {
        console.error('Failed to setup menu event listeners:', error);
      }
    };

    void setupListeners();

    return () => {
      isActive = false;
      menuUnlistenersRef.current.forEach(unlisten => unlisten());
      menuUnlistenersRef.current = [];
    };
  }, [editor, activeDocumentId, createNewDocument, closeDocument, toggleSidebar]);

  const titlebarClassName = useMemo(() => {
    if (osPlatform === 'macos') {
      return 'h-7 flex items-center border-b bg-background/95 px-3';
    }
    return 'h-10 flex items-center border-b bg-background/95 px-2';
  }, [osPlatform]);

  const handleTitlebarMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isNoDrag = !!target.closest('.titlebar-no-drag');
    if (isNoDrag) {
      return;
    }
    try {
      const currentWindow = getCurrentWindow();
      void currentWindow.startDragging();
    } catch (error) {
      console.warn('Failed to start dragging:', error);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {!isFullscreen && (
        <WindowTitlebar
          className={`${titlebarClassName}`}
          controlsOrder="system"
          windowControlsProps={{
            justify: true,
            platform: osPlatform ?? undefined,
            hide: osPlatform === 'macos',
          }}
          onMouseDown={handleTitlebarMouseDown}
        >
          <div className="flex w-full items-center gap-2">
            {osPlatform !== 'macos' && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground titlebar-no-drag"
                aria-label="Toggle sidebar"
                data-tauri-drag-region="false"
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <div
              className="flex flex-1 items-center justify-center gap-2 text-sm font-medium text-foreground/90 min-w-0 titlebar-drag"
              data-tauri-drag-region
            >
              <span className="truncate">{documentTitle}</span>
              {activeDocument?.isDirty && (
                <span className="text-xs font-semibold text-amber-500">{t('common.edited')}</span>
              )}
            </div>
            <ThemeSelector />
            {osPlatform === 'macos' && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground titlebar-no-drag"
                aria-label="Toggle sidebar"
                data-tauri-drag-region="false"
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </WindowTitlebar>
      )}
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`flex-shrink-0 transition-[width] duration-200 ${
            sidebarVisible ? 'w-72' : 'w-0 overflow-hidden pointer-events-none'
          }`}
          aria-hidden={!sidebarVisible}
        >
          <Sidebar />
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeDocumentId ? (
            <>
              <div className="flex-1 overflow-hidden">
                {editorMode === 'wysiwyg' ? (
                  <Editor documentId={activeDocumentId} />
                ) : (
                  <SourceEditor documentId={activeDocumentId} />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">{t('common.no_document_open')}</p>
                <p className="text-sm mt-2">
                  {t('common.create_or_open')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
