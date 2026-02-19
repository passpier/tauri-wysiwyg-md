import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentStore } from '@/stores/documentStore';
import { useUIStore } from '@/stores/uiStore';
import { useEditorLayout } from '@/hooks/useEditorLayout';
import { FindBar } from './FindBar';

interface SourceEditorProps {
  documentId: string;
}

interface SourceMatch {
  start: number;
  end: number;
}

function findMatches(text: string, term: string): SourceMatch[] {
  if (!term) return [];
  const results: SourceMatch[] = [];
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    results.push({ start: m.index, end: m.index + m[0].length });
  }
  return results;
}

export const SourceEditor = ({ documentId }: SourceEditorProps) => {
  const { t } = useTranslation();
  const documents = useDocumentStore((state) => state.documents);
  const updateContent = useDocumentStore((state) => state.updateContent);
  const fontSize = useUIStore((state) => state.fontSize);
  const fontFamily = useUIStore((state) => state.fontFamily);
  const findBarVisible = useUIStore((state) => state.findBarVisible);
  const setFindBarVisible = useUIStore((state) => state.setFindBarVisible);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const layoutMetrics = useEditorLayout(containerRef);

  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [replaceVisible, setReplaceVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const doc = documents.find((d) => d.id === documentId);

  useEffect(() => {
    if (textareaRef.current && doc) {
      textareaRef.current.value = doc.content;
    }
  }, [documentId]);

  // Close find bar when document changes
  useEffect(() => {
    setFindBarVisible(false);
  }, [documentId, setFindBarVisible]);

  const content = doc?.content ?? '';
  const matches = findMatches(content, searchTerm);
  const matchCount = matches.length;

  const scrollToMatch = useCallback((index: number) => {
    const textarea = textareaRef.current;
    if (!textarea || matches.length === 0) return;
    const match = matches[index];
    if (!match) return;
    textarea.focus();
    textarea.setSelectionRange(match.start, match.end);

    // Estimate line height to scroll to the match
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight || '20', 10);
    const textBefore = content.slice(0, match.start);
    const linesBefore = (textBefore.match(/\n/g) || []).length;
    textarea.scrollTop = linesBefore * lineHeight - textarea.clientHeight / 2;
  }, [matches, content]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentIndex(0);
  }, []);

  const handleNext = useCallback(() => {
    if (matchCount === 0) return;
    const next = (currentIndex + 1) % matchCount;
    setCurrentIndex(next);
    scrollToMatch(next);
  }, [currentIndex, matchCount, scrollToMatch]);

  const handlePrev = useCallback(() => {
    if (matchCount === 0) return;
    const prev = (currentIndex - 1 + matchCount) % matchCount;
    setCurrentIndex(prev);
    scrollToMatch(prev);
  }, [currentIndex, matchCount, scrollToMatch]);

  const handleReplace = useCallback(() => {
    if (matchCount === 0 || !doc) return;
    const match = matches[currentIndex];
    if (!match) return;
    const newContent =
      content.slice(0, match.start) + replaceTerm + content.slice(match.end);
    updateContent(documentId, newContent);
    if (textareaRef.current) {
      textareaRef.current.value = newContent;
    }
    // Move to next match
    const newMatches = findMatches(newContent, searchTerm);
    const newIndex = Math.min(currentIndex, Math.max(0, newMatches.length - 1));
    setCurrentIndex(newIndex);
  }, [matchCount, matches, currentIndex, content, replaceTerm, searchTerm, doc, documentId, updateContent]);

  const handleReplaceAll = useCallback(() => {
    if (matchCount === 0 || !doc) return;
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const newContent = content.replace(new RegExp(escaped, 'gi'), replaceTerm);
    updateContent(documentId, newContent);
    if (textareaRef.current) {
      textareaRef.current.value = newContent;
    }
    setCurrentIndex(0);
  }, [matchCount, searchTerm, replaceTerm, content, doc, documentId, updateContent]);

  const handleCloseFindBar = useCallback(() => {
    setFindBarVisible(false);
    textareaRef.current?.focus();
  }, [setFindBarVisible]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateContent(documentId, e.target.value);
  };

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t('common.no_document_open')}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {findBarVisible && (
        <FindBar
          searchTerm={searchTerm}
          replaceTerm={replaceTerm}
          matchCount={matchCount}
          currentMatch={matchCount > 0 ? currentIndex + 1 : 0}
          replaceVisible={replaceVisible}
          onSearchChange={handleSearchChange}
          onReplaceChange={setReplaceTerm}
          onNext={handleNext}
          onPrev={handlePrev}
          onReplace={handleReplace}
          onReplaceAll={handleReplaceAll}
          onClose={handleCloseFindBar}
          onToggleReplace={() => setReplaceVisible((v) => !v)}
        />
      )}
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden flex justify-center px-4 py-6"
      >
        <textarea
          ref={textareaRef}
          className="h-full w-full resize-none bg-transparent focus:outline-none leading-relaxed"
          style={{
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily.includes('mono') ? fontFamily : `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`,
            maxWidth: `${layoutMetrics.contentWidth}px`,
          }}
          onChange={handleChange}
          spellCheck={false}
          placeholder={t('editor.placeholder')}
        />
      </div>
    </div>
  );
};
