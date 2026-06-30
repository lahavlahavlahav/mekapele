/**
 * MainControl.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Top-level dual-view controller.
 *
 * Responsibilities:
 *   1. Render the toggle bar ("Preview 3D" | "Exact Pattern").
 *   2. Lazy-load BookPreview3D (no SSR — Three.js needs the DOM).
 *   3. Render WorkshopTracker in Workshop Mode.
 *   4. Pass through any pattern data fed in from a parent (ConfigPanel).
 *
 * Usage (in your page or layout):
 *   <MainControl rows={algoOutput} projectId="abc123" pageHeightCm={20} />
 *
 * Or, if the store is pre-populated upstream, just:
 *   <MainControl />
 */

"use client";

import React, { useEffect, useTransition, lazy, Suspense } from "react";
import { useDualViewStore, FoldRow, ViewMode } from "@/lib/dualViewStore";
import WorkshopTracker from "@/components/tracker/WorkshopTracker";

// ── Lazy-load 3D component (no SSR) ──────────────────────────────────────────

const BookPreview3D = lazy(() => import("@/components/BookPreview3D"));

// ── Toggle tab button ────────────────────────────────────────────────────────

interface TabProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

function Tab({ label, active, onClick, icon }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
        transition-all duration-200 active:scale-95
        ${active
          ? "bg-amber-500 text-stone-950 shadow-lg shadow-amber-900/30"
          : "text-stone-400 hover:text-stone-200 hover:bg-stone-800"
        }
      `}
    >
      {icon}
      {label}
      {active && (
        <span className="absolute inset-0 rounded-xl ring-1 ring-amber-400/40 pointer-events-none" />
      )}
    </button>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function Icon3D() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function IconWorkshop() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ── 3D Skeleton ───────────────────────────────────────────────────────────────

function Skeleton3D() {
  return (
    <div className="w-full h-full min-h-[420px] rounded-2xl bg-stone-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        <p className="text-stone-600 text-sm">טוען מנוע תלת-ממד…</p>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MainControlProps {
  /** Optionally pass pattern data from a parent (e.g. ConfigPanel). */
  rows?: FoldRow[];
  projectId?: string;
  pageHeightCm?: number;
}

// ── MainControl ───────────────────────────────────────────────────────────────

export default function MainControl({
  rows,
  projectId,
  pageHeightCm,
}: MainControlProps) {
  const mode = useDualViewStore((s) => s.mode);
  const setMode = useDualViewStore((s) => s.setMode);
  const setPatternData = useDualViewStore((s) => s.setPatternData);
  const storeRows = useDualViewStore((s) => s.rows);

  const [, startTransition] = useTransition();

  // Sync prop data into the store when provided by parent
  useEffect(() => {
    if (rows && rows.length > 0 && projectId) {
      setPatternData(rows, projectId, pageHeightCm ?? 20);
    }
  }, [rows, projectId, pageHeightCm, setPatternData]);

  const handleSwitch = (m: ViewMode) => {
    startTransition(() => setMode(m));
  };

  const hasData = storeRows.length > 0;

  return (
    <div
      className="flex flex-col gap-4 w-full h-full"
      dir="rtl"
    >
      {/* ── Toggle bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-stone-900/80 backdrop-blur-sm border border-stone-800 rounded-2xl p-1.5 shrink-0">
        <Tab
          label="תצוגה מקדימה 3D"
          active={mode === "3d"}
          onClick={() => handleSwitch("3d")}
          icon={<Icon3D />}
        />
        <Tab
          label="תבנית מדויקת"
          active={mode === "workshop"}
          onClick={() => handleSwitch("workshop")}
          icon={<IconWorkshop />}
        />

        {/* Stats pill (visible when data loaded) */}
        {hasData && (
          <div className="mr-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800/60 border border-stone-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] text-stone-400 tabular-nums">
              {new Set(storeRows.map((r) => r.page)).size} עמודים
            </span>
          </div>
        )}
      </div>

      {/* ── View panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {mode === "3d" ? (
          <Suspense fallback={<Skeleton3D />}>
            <BookPreview3D />
          </Suspense>
        ) : (
          <WorkshopTracker />
        )}
      </div>
    </div>
  );
}
