import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uid } from './ink';
import type { Page, Tool } from './types';

type Snapshot = Pick<Page, 'strokes' | 'texts' | 'images' | 'annotations'>;

type State = {
  pages: Record<string, Page>;
  // editor prefs
  tool: Tool;
  color: string;
  penSize: number;
  /** Ignore finger touches for drawing (palm rejection) — turn on with the S Pen */
  penOnly: boolean;
  // in-memory undo stacks per page (not persisted)
  undo: Record<string, Snapshot[]>;

  createPage: () => string;
  deletePage: (id: string) => void;
  /** Mutate a page. Pass `trackUndo` for user edits to the canvas. */
  updatePage: (id: string, fn: (p: Page) => Partial<Page>, trackUndo?: boolean) => void;
  undoPage: (id: string) => void;
  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setPenSize: (s: number) => void;
  setPenOnly: (v: boolean) => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      pages: {},
      tool: 'pen',
      color: '#1F2328',
      penSize: 4,
      penOnly: false,
      undo: {},

      createPage: () => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          pages: {
            ...s.pages,
            [id]: { id, title: 'Untitled', createdAt: now, updatedAt: now, strokes: [], texts: [], images: [], annotations: [], chat: [] },
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
          const undo = trackUndo
            ? {
                ...s.undo,
                [id]: [...(s.undo[id] ?? []).slice(-49), { strokes: page.strokes, texts: page.texts, images: page.images, annotations: page.annotations }],
              }
            : s.undo;
          return { pages: { ...s.pages, [id]: { ...page, ...fn(page), updatedAt: Date.now() } }, undo };
        }),
      undoPage: (id) => {
        const stack = get().undo[id];
        const prev = stack?.[stack.length - 1];
        if (!prev) return;
        set((s) => ({
          pages: { ...s.pages, [id]: { ...s.pages[id], ...prev } },
          undo: { ...s.undo, [id]: stack.slice(0, -1) },
        }));
      },
      setTool: (tool) => set({ tool }),
      setColor: (color) => set({ color, tool: get().tool === 'eraser' || get().tool === 'lasso' ? 'pen' : get().tool }),
      setPenSize: (penSize) => set({ penSize }),
      setPenOnly: (penOnly) => set({ penOnly }),
    }),
    {
      name: 'inkbuddy',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ undo, ...rest }) => rest,
    },
  ),
);
