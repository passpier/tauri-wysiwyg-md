import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Moon, Sun } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { THEME_NAMES, ThemeName } from '@/theme/types';
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function ThemeSelector() {
  const { t } = useTranslation();
  const currentTheme = useUIStore((state) => state.currentTheme);
  const setCurrentTheme = useUIStore((state) => state.setCurrentTheme);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const currentThemeData = THEME_NAMES[currentTheme];

  // Group themes by variant
  const lightThemes = Object.entries(THEME_NAMES).filter(
    ([_, theme]) => theme.variant === 'light'
  );
  const darkThemes = Object.entries(THEME_NAMES).filter(
    ([_, theme]) => theme.variant === 'dark'
  );

  const handleThemeSelect = (themeName: ThemeName) => {
    setCurrentTheme(themeName);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
    }
  };

  // Get icon based on variant
  const themeIcon =
    currentThemeData.variant === 'dark' ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    );

  const triggerButton = (
    <Button
      ref={triggerRef}
      variant="ghost"
      size="sm"
      className="gap-2 h-9 titlebar-no-drag"
      onKeyDown={handleKeyDown}
      aria-label={t('themes.select_theme')}
      title={t('themes.current_theme', { name: t(`themes.${currentTheme}`) })}
    >
      {themeIcon}
      <ChevronDown className="h-3 w-3 opacity-50" />
    </Button>
  );

  return (
    <DropdownMenu trigger={triggerButton}>
      <div className="py-2">
        <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('themes.light_themes')}
        </div>

        {lightThemes.map(([name, theme]) => (
          <DropdownMenuItem
            key={name}
            onClick={() => handleThemeSelect(name as ThemeName)}
            className={`${currentTheme === name ? 'bg-accent' : ''}`}
          >
            <Sun className="h-3 w-3 mr-2 opacity-50" />
            <span className="flex-1">{t(`themes.${name}`)}</span>
            {currentTheme === name && (
              <span className="text-xs font-semibold">✓</span>
            )}
          </DropdownMenuItem>
        ))}

        <div className="my-1 h-px bg-border" />

        <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('themes.dark_themes')}
        </div>

        {darkThemes.map(([name, theme]) => (
          <DropdownMenuItem
            key={name}
            onClick={() => handleThemeSelect(name as ThemeName)}
            className={`${currentTheme === name ? 'bg-accent' : ''}`}
          >
            <Moon className="h-3 w-3 mr-2 opacity-50" />
            <span className="flex-1">{t(`themes.${name}`)}</span>
            {currentTheme === name && (
              <span className="text-xs font-semibold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </div>
    </DropdownMenu>
  );
}
