import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProsemirrorNode } from '@tiptap/pm/model';

export interface SearchStorage {
  searchTerm: string;
  results: { from: number; to: number }[];
  currentIndex: number;
}

type CommandProps = {
  editor: Editor;
  dispatch: ((tr: Transaction) => void) | undefined;
  tr: Transaction;
};

const searchPluginKey = new PluginKey<DecorationSet>('search');

function buildDecorations(
  state: EditorState,
  searchTerm: string,
  currentIndex: number,
): DecorationSet {
  if (!searchTerm) return DecorationSet.empty;

  const { doc } = state;
  const decorations: Decoration[] = [];
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let matchIndex = 0;
  const regex = new RegExp(escapedTerm, 'gi');

  doc.descendants((node: ProsemirrorNode, pos: number) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let m: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      const from = pos + m.index;
      const to = from + m[0].length;
      const isCurrent = matchIndex === currentIndex;
      decorations.push(
        Decoration.inline(from, to, {
          class: isCurrent ? 'search-result-current' : 'search-result',
        }),
      );
      matchIndex++;
    }
  });

  return DecorationSet.create(doc, decorations);
}

function findAllMatches(
  state: EditorState,
  searchTerm: string,
): { from: number; to: number }[] {
  if (!searchTerm) return [];
  const { doc } = state;
  const results: { from: number; to: number }[] = [];
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedTerm, 'gi');

  doc.descendants((node: ProsemirrorNode, pos: number) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let m: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      results.push({ from: pos + m.index, to: pos + m.index + m[0].length });
    }
  });

  return results;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearchTerm: (term: string) => ReturnType;
      findNext: () => ReturnType;
      findPrev: () => ReturnType;
      replaceCurrentMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
    };
  }
}

export const SearchExtension = Extension.create<object, SearchStorage>({
  name: 'search',

  addStorage() {
    return {
      searchTerm: '',
      results: [],
      currentIndex: 0,
    };
  },

  addCommands() {
    const storage = this.storage;

    return {
      setSearchTerm: (term: string) => ({ editor, dispatch, tr }: CommandProps) => {
        storage.searchTerm = term;
        storage.currentIndex = 0;
        storage.results = findAllMatches(editor.state, term);

        if (dispatch) {
          tr.setMeta(searchPluginKey, { searchTerm: term, currentIndex: 0 });
          dispatch(tr);
        }
        return true;
      },

      findNext: () => ({ editor, dispatch, tr }: CommandProps) => {
        const results = storage.results;
        if (results.length === 0) return false;

        storage.currentIndex = (storage.currentIndex + 1) % results.length;
        const current = results[storage.currentIndex];

        if (dispatch) {
          tr.setMeta(searchPluginKey, {
            searchTerm: storage.searchTerm,
            currentIndex: storage.currentIndex,
          });
          dispatch(tr);
        }

        setTimeout(() => {
          const domEl = editor.view.domAtPos(current.from);
          if (domEl?.node) {
            const el = domEl.node instanceof Text
              ? domEl.node.parentElement
              : (domEl.node as HTMLElement);
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }, 0);

        return true;
      },

      findPrev: () => ({ editor, dispatch, tr }: CommandProps) => {
        const results = storage.results;
        if (results.length === 0) return false;

        storage.currentIndex =
          (storage.currentIndex - 1 + results.length) % results.length;
        const current = results[storage.currentIndex];

        if (dispatch) {
          tr.setMeta(searchPluginKey, {
            searchTerm: storage.searchTerm,
            currentIndex: storage.currentIndex,
          });
          dispatch(tr);
        }

        setTimeout(() => {
          const domEl = editor.view.domAtPos(current.from);
          if (domEl?.node) {
            const el = domEl.node instanceof Text
              ? domEl.node.parentElement
              : (domEl.node as HTMLElement);
            el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }, 0);

        return true;
      },

      replaceCurrentMatch: (replacement: string) => ({ editor, dispatch, tr }: CommandProps) => {
        const results = storage.results;
        if (results.length === 0) return false;

        const current = results[storage.currentIndex];
        if (!current) return false;

        if (dispatch) {
          tr.replaceWith(
            current.from,
            current.to,
            editor.schema.text(replacement),
          );
          tr.setMeta(searchPluginKey, {
            searchTerm: storage.searchTerm,
            currentIndex: storage.currentIndex,
          });
          dispatch(tr);
        }

        setTimeout(() => {
          const newResults = findAllMatches(editor.state, storage.searchTerm);
          storage.results = newResults;
          storage.currentIndex = Math.min(
            storage.currentIndex,
            Math.max(0, newResults.length - 1),
          );
        }, 0);

        return true;
      },

      replaceAllMatches: (replacement: string) => ({ editor, dispatch, tr }: CommandProps) => {
        const results = storage.results;
        if (results.length === 0) return false;

        if (dispatch) {
          const sorted = [...results].sort((a, b) => b.from - a.from);
          for (const match of sorted) {
            tr.replaceWith(match.from, match.to, editor.schema.text(replacement));
          }
          tr.setMeta(searchPluginKey, { searchTerm: '', currentIndex: 0 });
          dispatch(tr);
        }

        storage.results = [];
        storage.currentIndex = 0;

        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(
            tr: Transaction,
            decorations: DecorationSet,
            _oldState: EditorState,
            newState: EditorState,
          ) {
            const meta = tr.getMeta(searchPluginKey) as
              | { searchTerm: string; currentIndex: number }
              | undefined;

            if (meta !== undefined) {
              return buildDecorations(newState, meta.searchTerm, meta.currentIndex);
            }

            if (tr.docChanged) {
              return buildDecorations(
                newState,
                storage.searchTerm,
                storage.currentIndex,
              );
            }

            return decorations.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state: EditorState) {
            return searchPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
