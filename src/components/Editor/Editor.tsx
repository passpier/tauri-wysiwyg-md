import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { all, createLowlight } from 'lowlight';
import { useEffect, useRef, useMemo } from 'react';
import { useDocumentStore } from '@/stores/documentStore';
import { useUIStore } from '@/stores/uiStore';
import { useEditorStore } from '@/stores/editorStore';
import { useEditorLayout } from '@/hooks/useEditorLayout';
import { debounce } from '@/lib/utils';
import '@/components/CodeBlockRenderer/CodeBlockRenderer.css';

interface EditorProps {
  documentId: string;
}

export function Editor({ documentId }: EditorProps) {
  const documents = useDocumentStore((state) => state.documents);
  const updateContent = useDocumentStore((state) => state.updateContent);
  const fontSize = useUIStore((state) => state.fontSize);
  const fontFamily = useUIStore((state) => state.fontFamily);
  const setEditor = useEditorStore((state) => state.setEditor);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutMetrics = useEditorLayout(containerRef);

  const document = documents.find(d => d.id === documentId);

  // Create lowlight instance with comprehensive language support
  // Using 'all' includes 180+ languages for syntax highlighting
  const lowlight = useMemo(() => createLowlight(all), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        codeBlock: false, // Disable default code block to use lowlight
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: null, // Null lets Tiptap detect language from markdown info string
        languageClassPrefix: 'language-', // Matches hljs class format: language-javascript, language-python, etc.
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Typography,
      Table.configure({
        resizable: true,
        handleWidth: 4,
        cellMinWidth: 50,
        lastColumnResizable: true,
        allowTableNodeSelection: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: document?.content || '',
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-sm sm:prose lg:prose-lg xl:prose-lg focus:outline-none w-full max-w-4xl',
        spellcheck: 'true',
      },
    },
    onUpdate: debounce(({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      updateContent(documentId, markdown);
    }, 500),
  });

  useEffect(() => {
    setEditor(editor ?? null);
    return () => setEditor(null);
  }, [editor, setEditor]);

  // Update editor content when document changes
  useEffect(() => {
    if (editor && document && editor.storage.markdown.getMarkdown() !== document.content) {
      console.log('📄 Loading document content:', document.content.substring(0, 100) + '...');
      
      // Clear any old enhancement wrappers before setting content
      editor.commands.clearContent();
      editor.commands.setContent(document.content);
      
      console.log('✅ Document content loaded');
    }
  }, [document?.content, editor, documentId]);

  // Apply font settings and responsive layout
  useEffect(() => {
    if (editor) {
      const editorElement = editor.view.dom;
      editorElement.style.fontSize = `${fontSize}px`;
      editorElement.style.fontFamily = fontFamily;
      
      // Apply responsive width based on layout metrics
      editorElement.style.maxWidth = `${layoutMetrics.contentWidth}px`;
      editorElement.style.width = '100%';
    }
  }, [fontSize, fontFamily, editor, layoutMetrics.contentWidth]);

  // REMOVED: Manual DOM manipulation was causing infinite loops
  // Syntax highlighting is already applied by lowlight
  // Use CSS pseudo-elements for language labels instead

  if (!document) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No document selected
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-full w-full overflow-auto flex justify-center px-4 py-6"
      data-layout-metrics={JSON.stringify(layoutMetrics)}
    >
      <EditorContent 
        editor={editor} 
        className="h-full"
        style={{
          width: '100%',
          maxWidth: `${layoutMetrics.contentWidth}px`,
        }}
      />
    </div>
  );
}
