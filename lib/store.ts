// =============================================================================
// STATE STORE  (Zustand + LocalStorage)
// -----------------------------------------------------------------------------
// Persists the generated pattern, settings, thumbnail, current tracker page,
// and the set of folded pages — so a workshop participant can close their
// phone mid-fold and resume exactly where they left off, no login required.
// =============================================================================

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BookConfig, FoldingPattern } from "./types";

export const DEFAULT_CONFIG: BookConfig = {
  firstPage: 41,
  lastPage: 360,
  pageHeightCm: 21.0,
  verticalSpacingCm: 16.0,
  mode: "MMF",
  minTabSizeMm: 1.0,
  direction: "RTL",
  cropSides: true,
  autoThreshold: true,
  precisionMm: 1,
};

export type AppView = "config" | "tracker" | "print" | "patterns" | "editGrid";

interface AppState {
  config: BookConfig;
  pattern: FoldingPattern | null;
  thumbnail: string | null; // data URL of the source image
  view: AppView;

  // Tracker progress
  currentPage: number; // 1-based
  foldedPages: number[]; // sorted list of completed page numbers

  // actions
  setConfig: (patch: Partial<BookConfig>) => void;
  loadPattern: (pattern: FoldingPattern, thumbnail: string | null) => void;
  setView: (view: AppView) => void;

  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  markCurrentFolded: () => void;
  unmarkCurrentFolded: () => void;
  resetProgress: () => void;
  resetAll: () => void;
  /** Manual grid-editor correction: overwrite one leaf's fold marks (cm, will be sorted). */
  setLeafMarks: (leaf: number, marksCm: number[]) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_CONFIG,
      pattern: null,
      thumbnail: null,
      view: "config",
      currentPage: 1,
      foldedPages: [],

      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),

      loadPattern: (pattern, thumbnail) =>
        set({
          pattern,
          thumbnail,
          config: pattern.config,
          view: "tracker",
          currentPage: 1,
          foldedPages: [],
        }),

      setView: (view) => set({ view }),

      goToPage: (page) => {
        const max = get().pattern?.pages.length ?? 1;
        set({ currentPage: Math.min(Math.max(1, page), max) });
      },

      nextPage: () => {
        const { currentPage, pattern } = get();
        const max = pattern?.pages.length ?? 1;
        set({ currentPage: Math.min(currentPage + 1, max) });
      },

      prevPage: () =>
        set((s) => ({ currentPage: Math.max(1, s.currentPage - 1) })),

      markCurrentFolded: () =>
        set((s) => {
          if (s.foldedPages.includes(s.currentPage)) return s;
          const foldedPages = [...s.foldedPages, s.currentPage].sort(
            (a, b) => a - b
          );
          const max = s.pattern?.pages.length ?? 1;
          // Auto-advance for a smooth folding rhythm.
          return {
            foldedPages,
            currentPage: Math.min(s.currentPage + 1, max),
          };
        }),

      unmarkCurrentFolded: () =>
        set((s) => ({
          foldedPages: s.foldedPages.filter((p) => p !== s.currentPage),
        })),

      resetProgress: () => set({ currentPage: 1, foldedPages: [] }),

      setLeafMarks: (leaf, marksCm) =>
        set((s) => {
          if (!s.pattern) return s;
          const sorted = [...marksCm].sort((a, b) => a - b);
          const pages = s.pattern.pages.map((p) =>
            p.leaf === leaf ? { ...p, marksCm: sorted, isBlank: sorted.length === 0 } : p
          );
          return { pattern: { ...s.pattern, pages } };
        }),

      resetAll: () =>
        set({
          config: DEFAULT_CONFIG,
          pattern: null,
          thumbnail: null,
          view: "config",
          currentPage: 1,
          foldedPages: [],
        }),
    }),
    {
      name: "lilou-book-folder-v1",
      storage: createJSONStorage(() => localStorage),
      // Persist everything that lets a session resume perfectly.
      partialize: (s) => ({
        config: s.config,
        pattern: s.pattern,
        thumbnail: s.thumbnail,
        view: s.view,
        currentPage: s.currentPage,
        foldedPages: s.foldedPages,
      }),
      // A user's localStorage may hold a config saved by an older version of
      // the app that predates fields like verticalSpacingCm/cropSides/
      // autoThreshold/precisionMm. Zustand's default merge replaces `config`
      // wholesale, so those fields would come back `undefined` and silently
      // break the algorithm (NaN measurements) and any UI that calls
      // `.toFixed()` on them. Backfill missing fields from DEFAULT_CONFIG
      // instead of trusting the persisted object to be complete.
      merge: (persisted, current) => {
        const persistedState = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...persistedState,
          config: { ...DEFAULT_CONFIG, ...persistedState.config },
        };
      },
    }
  )
);
