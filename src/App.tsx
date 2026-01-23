import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Editor } from '@/components/Editor/Editor';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { Toolbar } from '@/components/Toolbar/Toolbar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useDocumentStore } from '@/stores/documentStore';
import { useUIStore } from '@/stores/uiStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import {
  Save,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
  X,
  FileText,
  FilePlus,
  FolderOpen,
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

  // Initialize auto-save
  useAutoSave();

  const activeDocument = documents.find(d => d.id === activeDocumentId);

  // Get editor instance for toolbar
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: activeDocument?.content || '',
  });

  // Apply theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: New file
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        createNewDocument();
      }

      // Cmd/Ctrl + O: Open file
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        await handleOpenFile();
      }

      // Cmd/Ctrl + S: Save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (activeDocumentId) {
          if (activeDocument?.path) {
            try {
              await saveDocument(activeDocumentId);
            } catch (error) {
              console.error('Save failed:', error);
            }
          } else {
            // Save as dialog for new documents
            handleSaveAs();
          }
        }
      }

      // Cmd/Ctrl + B: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }

      // Cmd/Ctrl + W: Close document
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault();
        if (activeDocumentId) {
          closeDocument(activeDocumentId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeDocumentId,
    activeDocument,
    saveDocument,
    closeDocument,
    toggleSidebar,
    createNewDocument,
    handleOpenFile,
  ]);

  // Native menu events
  useEffect(() => {
    let unlistenNew: (() => void) | undefined;
    let unlistenOpen: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenNew = await listen('menu-new-file', () => {
        createNewDocument();
      });
      unlistenOpen = await listen('menu-open-file', () => {
        void handleOpenFile();
      });
    };

    setupListeners();

    return () => {
      unlistenNew?.();
      unlistenOpen?.();
    };
  }, [createNewDocument, handleOpenFile]);

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

  return (
    <div className="h-screen flex flex-col">
      {/* Top Menu Bar */}
      <div className="h-12 border-b flex items-center justify-between px-4 bg-background">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
          >
            {sidebarVisible ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <PanelLeft className="w-5 h-5" />
            )}
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="font-semibold text-lg">Markdown Editor</h1>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="sm" onClick={createNewDocument}>
            <FilePlus className="w-4 h-4 mr-2" />
            New
          </Button>
          <Button variant="ghost" size="sm" onClick={handleOpenFile}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Open
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {activeDocument && (
            <>
              <span className="text-sm text-muted-foreground">
                {activeDocument.path?.split('/').pop() || 'Untitled'}
                {activeDocument.isDirty && ' •'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleManualSave}
                disabled={!activeDocument.isDirty && !!activeDocument.path}
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </>
          )}
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Document Tabs */}
      {documents.length > 0 && (
        <div className="border-b bg-muted/30">
          <div className="flex overflow-x-auto">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => useDocumentStore.setState({ activeDocumentId: doc.id })}
                className={`
                  flex items-center gap-2 px-4 py-2 border-r
                  hover:bg-accent transition-colors
                  ${doc.id === activeDocumentId ? 'bg-background' : 'bg-muted/30'}
                `}
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm">
                  {doc.path?.split('/').pop() || 'Untitled'}
                  {doc.isDirty && ' •'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDocument(doc.id);
                  }}
                  className="hover:bg-accent rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

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
              <Toolbar editor={editor} />
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
