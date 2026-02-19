import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronUp, ChevronDown, Replace, ReplaceAll } from 'lucide-react';

export interface FindBarHandle {
  focusSearch: () => void;
}

interface FindBarProps {
  searchTerm: string;
  replaceTerm: string;
  matchCount: number;
  currentMatch: number;
  replaceVisible: boolean;
  onSearchChange: (value: string) => void;
  onReplaceChange: (value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
  onToggleReplace: () => void;
}

export function FindBar({
  searchTerm,
  replaceTerm,
  matchCount,
  currentMatch,
  replaceVisible,
  onSearchChange,
  onReplaceChange,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  onClose,
  onToggleReplace,
}: FindBarProps) {
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [onNext, onPrev, onClose]);

  const handleReplaceKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onReplace();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [onReplace, onClose]);

  const matchLabel = searchTerm
    ? matchCount === 0
      ? t('find.no_results')
      : t('find.match_count', { current: currentMatch, total: matchCount })
    : '';

  return (
    <div className="absolute top-0 right-4 z-50 bg-background border border-border rounded-b-lg shadow-lg min-w-72 max-w-sm">
      <div className="flex flex-col gap-1 p-2">
        {/* Search row */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleReplace}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={replaceVisible ? t('find.hide_replace') : t('find.show_replace')}
            aria-label={replaceVisible ? t('find.hide_replace') : t('find.show_replace')}
          >
            <span className={`text-xs transition-transform ${replaceVisible ? 'rotate-90' : ''}`}>▶</span>
          </button>
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('find.find_placeholder')}
              className="w-full h-7 px-2 pr-20 text-sm bg-input border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t('find.find_placeholder')}
            />
            {searchTerm && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground whitespace-nowrap">
                {matchLabel}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onPrev}
            disabled={matchCount === 0}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={t('find.previous')}
            aria-label={t('find.previous')}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={matchCount === 0}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={t('find.next')}
            aria-label={t('find.next')}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={t('find.close')}
            aria-label={t('find.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Replace row */}
        {replaceVisible && (
          <div className="flex items-center gap-1 pl-6">
            <input
              type="text"
              value={replaceTerm}
              onChange={(e) => onReplaceChange(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              placeholder={t('find.replace_placeholder')}
              className="flex-1 h-7 px-2 text-sm bg-input border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t('find.replace_placeholder')}
            />
            <button
              type="button"
              onClick={onReplace}
              disabled={matchCount === 0}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={t('find.replace')}
              aria-label={t('find.replace')}
            >
              <Replace className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onReplaceAll}
              disabled={matchCount === 0}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={t('find.replace_all')}
              aria-label={t('find.replace_all')}
            >
              <ReplaceAll className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
