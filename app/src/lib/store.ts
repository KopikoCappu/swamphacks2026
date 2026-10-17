import { appStorage } from './storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uid } from './ink';
import { FOLDER_COLORS } from './theme';
import type { Folder, Page, ShapeKind, Tool } from './types';

type Snapshot = Pick<Page, 'strokes' | 'texts' | 'maths' | 'images' | 'annotations'>;
type SizedTool = 'pen' | 'highlighter' | 'eraser';

export const SIZE_OPTIONS: Record<SizedTool, number[]> = {
  pen: [1.5, 2.5, 4, 6, 9, 14],
  highlighter: [10, 16, 22, 30, 40, 54],
  eraser: [6, 10, 16, 24, 36, 52], // radius
};

const MAX_HISTORY = 100;

/** Sync key for a note or folder. */
export const syncKey = (kind: 'note' | 'folder', id: string) => `${kind}:${id}`;

/** A row coming down from the cloud (see lib/sync.ts). `data` is absent for tombstones. */
export type RemoteItem = { kind: 'note' | 'folder'; id: string; updated_at: number; deleted: boolean; data?: unknown };

type State = {
  pages: Record<string, Page>;
  folders: Record<string, Folder>;
  // editor prefs
  tool: Tool;
  color: string;
  highlighterColor: string;
  sizes: Record<SizedTool, number>;
  shapeKind: ShapeKind;
  /** Ignore finger touches for drawing (palm rejection) — turn on with the S Pen */
  penOnly: boolean;
  // in-memory undo/redo stacks per page (not persisted)
  undo: Record<string, Snapshot[]>;
  redo: Record<string, Snapshot[]>;
  // --- cloud sync bookkeeping (persisted) ---
  /** syncKey → updatedAt of the version the cloud has, so only newer local changes get uploaded */
  synced: Record<string, number>;
  /** syncKey → when it was deleted locally (uploaded as a tombstone) */
  tombstones: Record<string, number>;

  createPage: (folderId?: string | null) => string;
  deletePage: (id: string) => void;
  movePage: (id: string, folderId: string | null) => void;
  createFolder: (name?: string) => string;
  renameFolder: (id: string, name: string) => void;
  setFolderColor: (id: string, color: string) => void;
  /** Notes inside go back to "no folder" — nothing is deleted. */
  deleteFolder: (id: string) => void;
  /** Mutate a page. Pass `trackUndo` for user edits to the canvas. */
  updatePage: (id: string, fn: (p: Page) => Partial<Page>, trackUndo?: boolean) => void;
  undoPage: (id: string) => void;
  redoPage: (id: string) => void;
  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setHighlighterColor: (c: string) => void;
  setSize: (tool: SizedTool, size: number) => void;
  setPenOnly: (v: boolean) => void;
  setShapeKind: (k: ShapeKind) => void;
  /** Merge rows from the cloud (last write wins on updatedAt). */
  applyRemote: (items: RemoteItem[]) => void;
  markSynced: (entries: Record<string, number>) => void;
  /** Sign-out: forget this account's notes on this device. */
  resetData: () => void;
};

const snapshot = (p: Page): Snapshot => ({ strokes: p.strokes, texts: p.texts, maths: p.maths ?? [], images: p.images, annotations: p.annotations });

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      pages: {},
      folders: {},
      tool: 'pen',
      color: '#1F2328',
      highlighterColor: '#FFD60A',
      sizes: { pen: 2.5, highlighter: 22, eraser: 16 },
      shapeKind: 'rect',
      penOnly: false,
      undo: {},
      redo: {},
      synced: {},
      tombstones: {},

      createPage: (folderId = null) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          pages: {
            ...s.pages,
            [id]: { id, title: 'Untitled', createdAt: now, updatedAt: now, strokes: [], texts: [], images: [], annotations: [], chat: [], paper: 'lined', bg: '#FFFFFF', folderId },
          },
        }));
        return id;
      },
      deletePage: (id) =>
        set((s) => {
          const { [id]: _, ...rest } = s.pages;
          return { pages: rest, tombstones: { ...s.tombstones, [syncKey('note', id)]: Date.now() } };
        }),
      movePage: (id, folderId) =>
        set((s) => (s.pages[id] ? { pages: { ...s.pages, [id]: { ...s.pages[id], folderId, updatedAt: Date.now() } } } : s)),
      createFolder: (name = 'New folder') => {
        const id = uid();
        const now = Date.now();
        set((s) => {
          // Next color in the palette, so new folders don't all look the same.
          const color = FOLDER_COLORS[Object.keys(s.folders).length % FOLDER_COLORS.length];
          return { folders: { ...s.folders, [id]: { id, name, color, createdAt: now, updatedAt: now } } };
        });
        return id;
      },
      renameFolder: (id, name) =>
        set((s) => (s.folders[id] ? { folders: { ...s.folders, [id]: { ...s.folders[id], name, updatedAt: Date.now() } } } : s)),
      setFolderColor: (id, color) =>
        set((s) => (s.folders[id] ? { folders: { ...s.folders, [id]: { ...s.folders[id], color, updatedAt: Date.now() } } } : s)),
      deleteFolder: (id) =>
        set((s) => {
          const now = Date.now();
          const { [id]: _, ...folders } = s.folders;
          const pages = Object.fromEntries(
            Object.entries(s.pages).map(([k, p]) => [k, p.folderId === id ? { ...p, folderId: null, updatedAt: now } : p]),
          );
          return { folders, pages, tombstones: { ...s.tombstones, [syncKey('folder', id)]: now } };
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
      setColor: (color) => set((s) => ({ color, tool: s.tool === 'pen' || s.tool === 'text' || s.tool === 'shape' ? s.tool : 'pen' })),
      setHighlighterColor: (highlighterColor) => set({ highlighterColor, tool: 'highlighter' }),
      setSize: (tool, size) => set((s) => ({ sizes: { ...s.sizes, [tool]: size } })),
      setPenOnly: (penOnly) => set({ penOnly }),
      setShapeKind: (shapeKind) => set({ shapeKind, tool: 'shape' }),

      applyRemote: (items) =>
        set((s) => {
          const pages = { ...s.pages };
          const folders = { ...s.folders };
          const synced = { ...s.synced };
          const tombstones = { ...s.tombstones };
          for (const it of items) {
            const k = syncKey(it.kind, it.id);
            const local = it.kind === 'note' ? pages[it.id] : folders[it.id];
            const localAt = local ? (local.updatedAt ?? local.createdAt) : (tombstones[k] ?? 0);
            if (it.updated_at < localAt) continue; // local is newer — it will be uploaded
            if (it.deleted) {
              if (it.kind === 'note') delete pages[it.id];
              else delete folders[it.id];
            } else if (it.data) {
              if (it.kind === 'note') pages[it.id] = { ...(it.data as Page), id: it.id, updatedAt: it.updated_at };
              else folders[it.id] = { ...(it.data as Folder), id: it.id, updatedAt: it.updated_at };
              delete tombstones[k];
            }
            synced[k] = it.updated_at;
          }
          return { pages, folders, synced, tombstones };
        }),
      markSynced: (entries) => set((s) => ({ synced: { ...s.synced, ...entries } })),
      resetData: () => set({ pages: {}, folders: {}, synced: {}, tombstones: {}, undo: {}, redo: {} }),
    }),
    {
      name: 'inkbuddy',
      version: 2,
      storage: createJSONStorage(() => appStorage),
      partialize: ({ undo, redo, ...rest }) => rest,
      // v0 stored a single `penSize`; fold it into `sizes`.
      migrate: (persisted, version) => {
        const s = persisted as Partial<State> & { penSize?: number };
        if (version < 1) {
          s.sizes = { pen: s.penSize ?? 2.5, highlighter: 22, eraser: 16 };
          delete s.penSize;
        }
        // v2: sync bookkeeping; folders track updatedAt.
        if (version < 2) {
          s.synced = {};
          s.tombstones = {};
          for (const f of Object.values(s.folders ?? {})) f.updatedAt ??= f.createdAt;
        }
        return s as State;
      },
    },
  ),
);
