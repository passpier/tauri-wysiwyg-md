import { useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { platform } from '@tauri-apps/plugin-os';
import { WindowTitlebar } from 'tauri-controls';
import { Editor } from '@/components/Editor/Editor';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { useDocumentStore } from '@/stores/documentStore';
import { useUIStore } from '@/stores/uiStore';
import { useEditorStore } from '@/stores/editorStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import {
  FileText,
  PanelLeft,
} from 'lucide-react';

function App() {
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const saveDocument = useDocumentStore((state) => state.saveDocument);
  const closeDocument = useDocumentStore((state) => state.closeDocument);
  const updateContent = useDocumentStore((state) => state.updateContent);
  const createNewDocument = useDocumentStore((state) => state.createNewDocument);
  const loadDocument = useDocumentStore((state) => state.loadDocument);
  
  const theme = useUIStore((state) => state.theme);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  const sidebarVisible = useUIStore((state) => state.sidebarVisible);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const hasInitializedDocument = useRef(false);
  const editor = useEditorStore((state) => state.editor);
  const menuUnlistenersRef = useRef<Array<() => void>>([]);
  const [osPlatform, setOsPlatform] = useState<'macos' | 'windows' | 'gnome' | null>(null);

  // Initialize auto-save
  useAutoSave();

  const activeDocument = documents.find(d => d.id === activeDocumentId);

  // Apply theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    let isActive = true;
    const loadPlatform = async () => {
      try {
        const detected = await platform();
        if (!isActive) return;
        if (detected === 'macos') {
          setOsPlatform('macos');
        } else if (detected === 'windows') {
          setOsPlatform('windows');
        } else {
          setOsPlatform('gnome');
        }
      } catch (error) {
        console.warn('Failed to detect platform:', error);
      }
    };

    void loadPlatform();
    return () => {
      isActive = false;
    };
  }, []);

  const getDocumentTitle = () => {
    if (!activeDocument) return 'Markdown Editor';

    const fileName = activeDocument.path
      ? activeDocument.path.split('/').pop() ?? 'Untitled'
      : 'Untitled';
    const editedSuffix = activeDocument.isDirty ? ' • Edited' : '';

    return `${fileName}${editedSuffix} - Markdown Editor`;
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

  const documentTitle = (() => {
    if (!activeDocument) return 'Markdown Editor';
    return activeDocument.path
      ? activeDocument.path.split('/').pop() ?? 'Untitled'
      : 'Untitled';
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
          listen('menu-toggle-theme', () => {
            toggleTheme();
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
  }, [editor, activeDocumentId, createNewDocument, closeDocument, toggleSidebar, toggleTheme]);

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
      <WindowTitlebar
        className={`${titlebarClassName} titlebar-drag`}
        controlsOrder="system"
        windowControlsProps={{
          justify: true,
          platform: osPlatform ?? undefined,
          hide: osPlatform === 'macos',
        }}
        data-tauri-drag-region
        onMouseDown={handleTitlebarMouseDown}
      >
        <div className="flex w-full items-center gap-2 titlebar-drag" data-tauri-drag-region>
          <div
            className="flex flex-1 items-center justify-center gap-2 text-sm font-medium text-foreground/90 min-w-0 titlebar-drag"
            data-tauri-drag-region
          >
            <span className="truncate">{documentTitle}</span>
            {activeDocument?.isDirty && (
              <span className="text-xs font-semibold text-amber-500">Edited</span>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground titlebar-no-drag"
            aria-label="Toggle sidebar"
            data-tauri-drag-region="false"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </WindowTitlebar>
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarVisible && (
          <div className="w-72 flex-shrink-0">
            <Sidebar />
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeDocumentId ? (
            <>
              <div className="flex-1 overflow-hidden">
                <Editor documentId={activeDocumentId} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg">No document open</p>
                <p className="text-sm mt-2">
                  Create a new document or open an existing one
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm">
                  <span className="inline-block w-0.5 h-5 bg-muted-foreground/70 animate-pulse" />
                  <span>Start writing...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
