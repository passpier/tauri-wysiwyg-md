import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Search, CaseSensitive, Regex, ChevronDown, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDocumentStore } from '@/stores/documentStore';
import { useUIStore } from '@/stores/uiStore';

interface SearchResult {
  file_path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}

interface GroupedResults {
  filePath: string;
  fileName: string;
  results: SearchResult[];
  collapsed: boolean;
}

interface SearchPanelProps {
  currentDirectory: string | null;
  focusTrigger: number;
}

export function SearchPanel({ currentDirectory, focusTrigger }: SearchPanelProps) {
  const { t } = useTranslation();
  const loadDocument = useDocumentStore((state) => state.loadDocument);
  const setSidebarVisible = useUIStore((state) => state.setSidebarVisible);

  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [groups, setGroups] = useState<GroupedResults[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when trigger changes (e.g. from Cmd+Shift+F)
  useEffect(() => {
    if (focusTrigger > 0) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [focusTrigger]);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !currentDirectory) {
        setResults([]);
        setGroups([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await invoke<SearchResult[]>('search_in_files', {
          root: currentDirectory,
          query: q,
          caseSensitive,
          useRegex,
        });
        setResults(res);

        // Group by file
        const map = new Map<string, SearchResult[]>();
        for (const r of res) {
          const existing = map.get(r.file_path) ?? [];
          existing.push(r);
          map.set(r.file_path, existing);
        }
        const newGroups: GroupedResults[] = [];
        map.forEach((groupResults, filePath) => {
          newGroups.push({
            filePath,
            fileName: filePath.split('/').pop() ?? filePath,
            results: groupResults,
            collapsed: false,
          });
        });
        setGroups(newGroups);
        setSearched(true);
      } catch (e) {
        setError(String(e));
        setResults([]);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    },
    [currentDirectory, caseSensitive, useRegex],
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(val);
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void runSearch(query);
    }
  };

  // Re-run search when options change
  useEffect(() => {
    if (query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runSearch(query);
      }, 200);
    }
  }, [caseSensitive, useRegex]);

  const toggleCollapse = (filePath: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.filePath === filePath ? { ...g, collapsed: !g.collapsed } : g,
      ),
    );
  };

  const handleResultClick = async (result: SearchResult) => {
    try {
      await loadDocument(result.file_path);
      // Ensure sidebar stays open
      setSidebarVisible(true);
    } catch (e) {
      console.error('Failed to open file from search:', e);
    }
  };

  const totalMatches = results.length;
  const totalFiles = groups.length;

  const highlightMatch = (line: string, start: number, end: number) => {
    const before = line.slice(0, start);
    const match = line.slice(start, end);
    const after = line.slice(end);
    const maxLen = 80;
    const trimBefore = before.length > 30 ? '…' + before.slice(-30) : before;
    const trimAfter = after.length > maxLen - trimBefore.length - match.length
      ? after.slice(0, Math.max(20, maxLen - trimBefore.length - match.length)) + '…'
      : after;

    return (
      <span className="text-xs font-mono text-foreground/80">
        {trimBefore}
        <mark className="bg-yellow-300/60 dark:bg-yellow-600/50 text-inherit rounded-sm px-0.5">
          {match}
        </mark>
        {trimAfter}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-3 py-2 space-y-1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="w-full h-7 pl-7 pr-2 text-sm bg-input border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {/* Options */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCaseSensitive((v) => !v)}
            title={t('search.case_sensitive')}
            className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors ${
              caseSensitive
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            <CaseSensitive className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setUseRegex((v) => !v)}
            title={t('search.use_regex')}
            className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors ${
              useRegex
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            <Regex className="w-3.5 h-3.5" />
          </button>
          {searched && !loading && (
            <span className="ml-auto text-xs text-muted-foreground">
              {totalMatches > 0
                ? t('search.result_summary', { matches: totalMatches, files: totalFiles })
                : t('search.no_results')}
            </span>
          )}
        </div>
      </div>

      {/* No folder open message */}
      {!currentDirectory && (
        <div className="flex-1 flex items-start justify-center px-3 pt-4">
          <p className="text-xs text-muted-foreground text-center">
            {t('search.open_folder_first')}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 px-2 py-1.5 rounded bg-destructive/10 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">{t('common.loading')}</span>
        </div>
      )}

      {/* Results */}
      {!loading && currentDirectory && (
        <ScrollArea className="flex-1">
          <div className="px-1 pb-2">
            {groups.map((group) => (
              <div key={group.filePath} className="mb-1">
                {/* File header */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.filePath)}
                  className="w-full flex items-center gap-1 px-2 py-1 rounded text-left hover:bg-accent/50 transition-colors group"
                >
                  {group.collapsed ? (
                    <ChevronRight className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                  )}
                  <FileText className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
                  <span className="text-xs font-medium truncate flex-1" title={group.filePath}>
                    {group.fileName}
                  </span>
                  <span className="text-xs text-muted-foreground bg-muted rounded px-1 flex-shrink-0">
                    {group.results.length}
                  </span>
                </button>

                {/* Match lines */}
                {!group.collapsed && (
                  <div className="ml-4">
                    {group.results.map((result, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleResultClick(result)}
                        className="w-full flex items-start gap-2 px-2 py-1 rounded text-left hover:bg-accent transition-colors"
                      >
                        <span className="text-xs text-muted-foreground w-8 flex-shrink-0 text-right font-mono">
                          {result.line_number}
                        </span>
                        <span className="flex-1 min-w-0 overflow-hidden">
                          {highlightMatch(
                            result.line_content.trimStart(),
                            result.match_start - (result.line_content.length - result.line_content.trimStart().length),
                            result.match_end - (result.line_content.length - result.line_content.trimStart().length),
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {searched && groups.length === 0 && !loading && query && (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t('search.no_results')}
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
