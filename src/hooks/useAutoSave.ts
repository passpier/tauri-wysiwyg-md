import { useEffect, useRef } from 'react';
import { useDocumentStore } from '@/stores/documentStore';
import { useSettingsStore } from '@/stores/settingsStore';

export const useAutoSave = () => {
  const autoSave = useSettingsStore((state) => state.autoSave);
  const interval = useSettingsStore((state) => state.autoSaveInterval);
  const saveDocument = useDocumentStore((state) => state.saveDocument);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!autoSave) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const { documents } = useDocumentStore.getState();
      
      // Save all dirty documents that have a path
      documents
        .filter(d => d.isDirty && d.path)
        .forEach(d => {
          saveDocument(d.id).catch(error => {
            console.error(`Auto-save failed for ${d.path}:`, error);
          });
        });
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoSave, interval, saveDocument]);
};
