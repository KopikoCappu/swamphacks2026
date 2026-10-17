import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uid } from './ink';
import type { Page, Tool } from './types';

type Snapshot = Pick<Page, 'strokes' | 'texts' | 'images' | 'annotations'>;
type SizedTool = 'pen' | 'highlighter' | 'eraser';

export const SIZE_OPTIONS: Record<SizedTool, number[]> = {
  pen: [1.5, 2.5, 4, 6, 9, 14],
  highlighter: [10, 16, 22, 30, 40, 54],
  eraser: [6, 10, 16, 24, 36, 52], // radius
};

const MAX_HISTORY = 100;

type State = {
  pages: Record<string, Page>;
  // editor prefs
  tool: Tool;
  color: string;
  highlighterColor: string;
  sizes: Record<SizedTool, number>;
  /** Ignore finger touches for drawing (palm rejection) — turn on with the S Pen */
  penOnly: boolean;
  // in-memory undo/redo stacks per page (not persisted)
  undo: Record<string, Snapshot[]>;
  redo: Record<string, Snapshot[]>;

  createPage: () => string;
  deletePage: (id: string) => void;
  /** Mutate a page. Pass `trackUndo` for user edits to the canvas. */
  updatePage: (id: string, fn: (p: Page) => Partial<Page>, trackUndo?: boolean) => void;
  undoPage: (id: string) => void;
  redoPage: (id: string) => void;
  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setHighlighterColor: (c: string) => void;
  setSize: (tool: SizedTool, size: number) => void;
  setPenOnly: (v: boolean) => void;
};

const snapshot = (p: Page): Snapshot => ({ strokes: p.strokes, texts: p.texts, images: p.images, annotations: p.annotations });

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      pages: {},
      tool: 'pen',
      color: '#1F2328',
      highlighterColor: '#FFD60A',
      sizes: { pen: 2.5, highlighter: 22, eraser: 16 },
      penOnly: false,
      undo: {},
      redo: {},

      createPage: () => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          pages: {
            ...s.pages,
            [id]: { id, title: 'Untitled', createdAt: now, updatedAt: now, strokes: [], texts: [], images: [], annotations: [], chat: [], paper: 'lined' },
          },
        }));
        return id;
      },
      deletePage: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.pages;
          return { pages: rest };
        }),
      updatePage: (id, fn, trackUndo) =>
        set((s) => {
          const page = s.pages[id];
          if (!page) return s;
          const history = trackUndo
            ? {
                undo: { ...s.undo, [id]: [...(s.undo[id] ?? []).slice(-(MAX_HISTORY - 1)), snapshot(page)] },
                redo: { ...s.redo, [id]: [] }, // a new edit invalidates redo
              }
            : {};
          return { pages: { ...s.pages, [id]: { ...page, ...fn(page), updatedAt: Date.now() } }, ...history };
        }),
      undoPage: (id) => {
        const { undo, redo, pages } = get();
        const stack = undo[id];
        const prev = stack?.[stack.length - 1];
        if (!prev || !pages[id]) return;
        set({
          pages: { ...pages, [id]: { ...pages[id], ...prev } },
          undo: { ...undo, [id]: stack.slice(0, -1) },
          redo: { ...redo, [id]: [...(redo[id] ?? []), snapshot(pages[id])] },
        });
      },
      redoPage: (id) => {
        const { undo, redo, pages } = get();
        const stack = redo[id];
        const next = stack?.[stack.length - 1];
        if (!next || !pages[id]) return;
        set({
          pages: { ...pages, [id]: { ...pages[id], ...next } },
          redo: { ...redo, [id]: stack.slice(0, -1) },
          undo: { ...undo, [id]: [...(undo[id] ?? []), snapshot(pages[id])] },
        });
      },
      setTool: (tool) => set({ tool }),
      setColor: (color) => set((s) => ({ color, tool: s.tool === 'pen' || s.tool === 'text' ? s.tool : 'pen' })),
      setHighlighterColor: (highlighterColor) => set({ highlighterColor, tool: 'highlighter' }),
      setSize: (tool, size) => set((s) => ({ sizes: { ...s.sizes, [tool]: size } })),
      setPenOnly: (penOnly) => set({ penOnly }),
    }),
    {
      name: 'inkbuddy',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ undo, redo, ...rest }) => rest,
      // v0 stored a single `penSize`; fold it into `sizes`.
      migrate: (persisted, version) => {
        const s = persisted as Partial<State> & { penSize?: number };
        if (version < 1) {
          s.sizes = { pen: s.penSize ?? 2.5, highlighter: 22, eraser: 16 };
          delete s.penSize;
        }
        return s as State;
      },
    },
  ),
);
