"use client";
// =============================================================================
// components/MainControl.tsx
// -----------------------------------------------------------------------------
// Top-level shell that owns the view-mode toggle and renders either
// BookPreview3D or WorkshopTracker.
//
// Design: dark navy canvas for 3D; clean paper-white for workshop.
// The toggle is a pill-switcher positioned top-right, always visible.
// =============================================================================

import React, { Suspense } from "react";
import { useViewStore, type ViewMode } from "@/lib/viewStore";
import WorkshopTracker from "@/components/WorkshopTracker";

// Lazy-load the heavy R3F bundle so the Workshop mode stays lightweight.
const BookPreview3D = React.lazy(() => import("@/components/BookPreview3D"));

// ── Tab button ────────────────────────────────────────────────────────────────
interface TabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}
function Tab({ label, active, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={[
        "px-5 py-2 text-sm font-semibold rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
        active
          ? "bg-amber-400 text-slate-900 shadow-md"
          : "text-slate-300 hover:text-white",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

// ── 3-D canvas skeleton ───────────────────────────────────────────────────────
function CanvasFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
      <svg
        className="animate-spin w-8 h-8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"
        />
      </svg>
      <span className="text-xs tracking-widest uppercase">Loading 3D engine…</span>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function MainControl() {
  const mode = useViewStore((s) => s.mode);
  const setMode = useViewStore((s) => s.setMode);

  const is3D = mode === "3d-preview";

  return (
    <div
      className={[
        "relative flex flex-col min-h-screen transition-colors duration-500",
        is3D ? "bg-slate-900" : "bg-stone-50",
      ].join(" ")}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className={[
          "flex items-center justify-between px-4 py-3 border-b",
          is3D
            ? "border-slate-700 bg-slate-900/80 backdrop-blur-sm"
            : "border-stone-200 bg-white shadow-sm",
        ].join(" ")}
      >
        {/* Brand word-mark */}
        <span
          className={[
            "text-lg font-bold tracking-tight",
            is3D ? "text-white" : "text-slate-800",
          ].join(" ")}
        >
          <span className="text-amber-400">meka</span>pele
        </span>

        {/* Pill toggle */}
        <nav
          aria-label="View mode"
          className={[
            "flex items-center gap-1 rounded-full p-1",
            is3D ? "bg-slate-800" : "bg-stone-100",
          ].join(" ")}
        >
          <Tab
            label="Preview 3D"
            active={is3D}
            onClick={() => setMode("3d-preview" as ViewMode)}
          />
          <Tab
            label="Exact Pattern"
            active={!is3D}
            onClick={() => setMode("workshop" as ViewMode)}
          />
        </nav>
      </header>

      {/* ── Content area ────────────────────────────────────────────────── */}
      <main className="flex-1 relative overflow-hidden">
        {is3D ? (
          <Suspense fallback={<CanvasFallback />}>
            <BookPreview3D />
          </Suspense>
        ) : (
          <WorkshopTracker />
        )}
      </main>
    </div>
  );
}
