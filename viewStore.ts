// =============================================================================
// lib/viewStore.ts
// -----------------------------------------------------------------------------
// Zustand store for:
//   • toggling between "3d-preview" and "workshop" views
//   • tracking per-page completion (local optimistic state)
//
// Firestore sync lives in WorkshopTracker — this store is the fast local layer.
// =============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "3d-preview" | "workshop";

export interface FoldRow {
  page: number;        // 1-based page number
  from: number;        // fold measurement from (cm)
  to: number;          // fold measurement to (cm)
  type: "MMF" | "CutFold";
}

interface ViewState {
  // ── View toggle ────────────────────────────────────────────────────────────
  mode: ViewMode;
  setMode: (m: ViewMode) => void;

  // ── Pattern data (set after generation) ───────────────────────────────────
  rows: FoldRow[];
  setRows: (rows: FoldRow[]) => void;

  // ── Completion tracking (local; synced to Firestore by WorkshopTracker) ───
  completed: Record<number, boolean>; // page → done?
  toggleCompleted: (page: number) => void;
  resetCompleted: () => void;

  // ── Derived ───────────────────────────────────────────────────────────────
  progressPct: () => number;
}

export const useViewStore = create<ViewState>()(
  persist(
    (set, get) => ({
      mode: "workshop",
      setMode: (m) => set({ mode: m }),

      rows: [],
      setRows: (rows) => set({ rows }),

      completed: {},
      toggleCompleted: (page) =>
        set((s) => ({
          completed: { ...s.completed, [page]: !s.completed[page] },
        })),
      resetCompleted: () => set({ completed: {} }),

      progressPct: () => {
        const { rows, completed } = get();
        const total = rows.length;
        if (total === 0) return 0;
        const done = rows.filter((r) => completed[r.page]).length;
        return Math.round((done / total) * 100);
      },
    }),
    {
      name: "mekapele-view-store",
      partialize: (s) => ({ completed: s.completed, rows: s.rows }),
    }
  )
);
