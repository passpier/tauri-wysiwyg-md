/**
 * Language utilities for consistent language code handling
 * Standardizes language codes across frontend and backend
 * Supports: English (en) and Traditional Chinese (繁體中文, zh)
 */

export type SupportedLanguage = 'en' | 'zh';

/**
 * Normalize language code to supported format
 * Handles various formats: 'en', 'en-US', 'zh', 'zh-TW', 'zh-HK', etc.
 */
export function normalizeLanguageCode(code: string | null | undefined): SupportedLanguage {
  if (!code) return 'en';
  
  const normalized = code.toLowerCase().split('-')[0];
  
  if (normalized === 'zh') return 'zh';
  if (normalized === 'en') return 'en';
  
  // Fallback to English for unsupported languages
  return 'en';
}

/**
 * Get the primary language code (without region)
 * Safe version that always returns a valid SupportedLanguage
 */
export function getPrimaryLanguageCode(fullCode: string): SupportedLanguage {
  return normalizeLanguageCode(fullCode);
}

/**
 * Language initialization priority order
 * Higher priority = checked first
 * Ensures consistent language selection across the app
 */
export const LANGUAGE_INITIALIZATION_PRIORITY = [
  'localStorage',    // User explicitly saved preference (highest priority)
  'systemLocale',    // System OS locale
  'browserLocale',   // Browser navigator.language
  'default',         // Hardcoded default (lowest priority)
] as const;
