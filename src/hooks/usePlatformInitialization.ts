import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Initializes the OS platform and language early.
 * This hook should be called at the very top of the App component.
 * 
 * Language initialization priority:
 * 1. localStorage (user saved preference)
 * 2. System OS locale
 * 3. Default to 'en'
 */
export function usePlatformInitialization() {
  const setOsPlatform = useUIStore((state) => state.setOsPlatform);
  const { language, updateSettings } = useSettingsStore();
  const initStartedRef = useRef(false);

  useEffect(() => {
    // Prevent double initialization in strict mode
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    let isActive = true;
    let unlistenInit: (() => void) | undefined;

    const initApp = async () => {
      try {
        // 1. Initialize language if not set (localStorage is empty)
        // localStorage has priority, so only detect system locale if no saved preference
        if (!language) {
          try {
            // Query backend for system locale (Tauri v2 best practice)
            const systemLocale = await invoke<string>('get_system_locale');
            if (isActive && systemLocale) {
              console.log(`🌍 System locale from backend: ${systemLocale}`);
              updateSettings({ language: systemLocale });
              console.log('✅ Language initialized from system locale');
            }
          } catch (localeError) {
            console.warn('Failed to get system locale from backend:', localeError);
            // Language already has default value from settings store, no action needed
          }
        }

        // 2. Immediately try to fetch platform from Rust command (fastest)
        invoke<string>('get_os_platform')
          .then((platform) => {
            if (!isActive) return;
            console.log('📱 Platform detected (invoke):', platform);
            if (platform === 'macos' || platform === 'windows' || platform === 'gnome') {
              setOsPlatform(platform);
            } else {
              setOsPlatform('gnome'); // Default fallback
            }
          })
          .catch((err) => console.warn('Failed to invoke get_os_platform:', err));

        // 3. Also listen for the event as a backup (in case of race wins)
        unlistenInit = await listen<string>('init-platform', (event) => {
          if (!isActive) return;
          const detectedPlatform = event.payload as 'macos' | 'windows' | 'gnome' | 'unknown';
          console.log('🎉 init-platform event received:', detectedPlatform);
          
          if (detectedPlatform !== 'unknown') {
            setOsPlatform(detectedPlatform);
          }
        });
      } catch (error) {
        console.warn('Failed to setup platform initialization:', error);
      }
    };

    void initApp();

    return () => {
      isActive = false;
      unlistenInit?.();
    };
  }, [setOsPlatform, language, updateSettings]);
}
