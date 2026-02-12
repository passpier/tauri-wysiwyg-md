import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useDocumentStore } from '@/stores/documentStore';
import { useRecentFiles } from '@/hooks/useRecentFiles';
import { FileItem } from './FileItem';
import { FolderOpen, FilePlus, Home } from 'lucide-react';

interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
}

export const Sidebar = memo(function Sidebar() {
  const { t } = useTranslation();
  const [currentDirectory, setCurrentDirectory] = useState<string | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { recentFiles, refresh: refreshRecent } = useRecentFiles();
  const loadDocument = useDocumentStore((state) => state.loadDocument);
  const createNewDocument = useDocumentStore((state) => state.createNewDocument);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const documents = useDocumentStore((state) => state.documents);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const entries = await invoke<FileEntry[]>('list_directory', { path });
      const filtered = entries.filter(
        (entry) =>
          entry.is_directory ||
          entry.name.endsWith('.md') ||
          entry.name.endsWith('.markdown'),
      );
      setFiles(filtered);
      setCurrentDirectory(path);
    } catch (error) {
      console.error('Failed to load directory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      
      if (selected && typeof selected === 'string') {
        loadDirectory(selected);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  const handleFileClick = async (file: FileEntry) => {
    if (file.is_directory) {
      loadDirectory(file.path);
    } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
      try {
        await loadDocument(file.path);
        refreshRecent();
      } catch (error) {
        console.error('Failed to load document:', error);
      }
    }
  };

  const handleRecentFileClick = async (path: string) => {
    try {
      await loadDocument(path);
      refreshRecent();
    } catch (error) {
      console.error('Failed to load recent file:', error);
    }
  };

  const handleNewFile = () => {
    createNewDocument();
  };

  const goToParentDirectory = () => {
    if (currentDirectory) {
      const parentPath = currentDirectory.split('/').slice(0, -1).join('/');
      if (parentPath) {
        loadDirectory(parentPath);
      }
    }
  };

  const activeDocument = documents.find(d => d.id === activeDocumentId);

  return (
    <div className="h-full flex flex-col bg-muted/30 border-r">
      {/* Header */}
      <div className="px-3 py-7 space-y-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenFolder}
            className="flex-1"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            {t('sidebar.open_folder')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewFile}
            title={t('sidebar.new_file')}
          >
            <FilePlus className="w-4 h-4" />
          </Button>
        </div>
        
        {currentDirectory && (
          <Button
            variant="ghost"
            size="sm"
            onClick={goToParentDirectory}
            className="w-full justify-start"
          >
            <Home className="w-4 h-4 mr-2" />
            <span className="truncate text-xs">{currentDirectory}</span>
          </Button>
        )}
      </div>

      <Separator />

      {/* Recent Files */}
      {recentFiles.length > 0 && (
        <>
          <div className="p-3">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">
              {t('sidebar.recent_files')}
            </h3>
            <div className="space-y-1">
              {recentFiles.slice(0, 5).map((path) => (
                <button
                  key={path}
                  onClick={() => handleRecentFileClick(path)}
                  className={`
                    w-full text-left px-2 py-1.5 rounded text-sm truncate
                    hover:bg-accent transition-colors
                    ${activeDocument?.path === path ? 'bg-accent' : ''}
                  `}
                  title={path}
                >
                  {path.split('/').pop()}
                </button>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* File List */}
      <ScrollArea className="flex-1 p-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : currentDirectory ? (
          files.length > 0 ? (
            <div className="space-y-1">
              {files.map((file) => (
                <FileItem
                  key={file.path}
                  file={file}
                  onClick={() => handleFileClick(file)}
                  isActive={activeDocument?.path === file.path}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {t('sidebar.no_files_found')}
            </div>
          )
        ) : (
          <div className="text-sm text-muted-foreground text-center mt-8 truncate">
            {t('sidebar.open_folder_to_browse')}
          </div>
        )}
      </ScrollArea>
    </div>
  );
});
