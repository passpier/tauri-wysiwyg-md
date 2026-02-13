import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import zh from './locales/zh.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      // English
      en: { translation: en },
      'en-US': { translation: en },
      // Traditional Chinese (繁體中文)
      zh: { translation: zh },
      'zh-TW': { translation: zh },
      'zh-HK': { translation: zh },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    // IMPORTANT: Auto-detection disabled to prevent conflicts with backend language detection
    // Language is now controlled by:
    // 1. User preference from localStorage (via usePlatformInitialization)
    // 2. System locale detected by Tauri backend (via get_system_locale)
    // 3. Default to 'en' if nothing else is set
    lng: 'en', // Initial language before hook initialization
  });

export default i18n;
