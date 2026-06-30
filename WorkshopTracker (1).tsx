/**
 * WorkshopTracker.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Workshop Mode — the mobile-first, step-by-step fold tracking interface.
 *
 * Layout (RTL, Hebrew):
 *   ┌──────────────────────────────┐
 *   │  [logo]           Print PDF  │
 *   │  ████████░░░░░░  75%         │  ← global progress bar
 *   │  ┌──────────────────────┐    │
 *   │  │  עמוד 47             │    │  ← FocusCard (current page)
 *   │  │  מ: 4.2 עד: 8.7 ס"מ │    │
 *   │  │  [✓ סמן כהושלם]      │    │
 *   │  └──────────────────────┘    │
 *   │  [prev] ───────── [next]     │
 *   │  ┄┄┄ all pages scroll ┄┄┄   │
 *   └──────────────────────────────┘
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { useDualViewStore, FoldRow } from "@/lib/dualViewStore";
import { useWorkshopSync } from "@/lib/hooks/useWorkshopSync";
import { generateWorkshopPDF } from "@/lib/pdfExport";

// ── ProgressBar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-stone-400 font-medium">התקדמות</span>
        <span className="text-xs font-bold tabular-nums text-amber-400">{pct}%</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-stone-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct === 100 && (
        <p className="text-center text-amber-400 text-xs mt-2 font-semibold animate-pulse">
          🎉 הושלם! הספר שלך מוכן
        </p>
      )}
    </div>
  );
}

// ── FocusCard — the big current-page widget ───────────────────────────────────

interface FocusCardProps {
  row: FoldRow;
  isDone: boolean;
  onToggle: () => void;
  isSaving: boolean;
}

function FocusCard({ row, isDone, onToggle, isSaving }: FocusCardProps) {
  const markH = row.endCm - row.startCm;

  return (
    <div
      className={`
        rounded-2xl border p-6 transition-all duration-300
        ${isDone
          ? "border-amber-500/60 bg-amber-950/30"
          : "border-stone-700/60 bg-stone-900/60"
        }
      `}
    >
      {/* Method badge */}
      <span
        className={`
          inline-block text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full mb-4
          ${row.method === "MMF"
            ? "bg-sky-900/60 text-sky-300"
            : "bg-violet-900/60 text-violet-300"
          }
        `}
      >
        {row.method === "MMF" ? "קיפול" : "חיתוך וקיפול"}
      </span>

      {/* Page number — huge */}
      <div className="flex items-end gap-3 mb-5">
        <span className="text-7xl font-black tabular-nums text-stone-100 leading-none">
          {row.page}
        </span>
        <span className="text-stone-500 text-sm mb-2">עמוד</span>
      </div>

      {/* Measurements */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "התחל", value: row.startCm },
          { label: "סיים", value: row.endCm },
          { label: "גובה", value: markH },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-stone-800/70 p-3 text-center">
            <p className="text-[10px] text-stone-500 mb-1">{label}</p>
            <p className="text-lg font-bold tabular-nums text-stone-100">
              {value.toFixed(1)}
            </p>
            <p className="text-[10px] text-stone-500">ס"מ</p>
          </div>
        ))}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        disabled={isSaving}
        className={`
          w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 active:scale-95
          ${isDone
            ? "bg-amber-500 text-stone-950 shadow-lg shadow-amber-900/40"
            : "bg-stone-800 text-stone-300 hover:bg-stone-700 border border-stone-700"
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {isSaving ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            שומר...
          </span>
        ) : isDone ? (
          "✓ הושלם"
        ) : (
          "סמן כהושלם"
        )}
      </button>
    </div>
  );
}

// ── MiniPageRow — compact row in the "all pages" list ────────────────────────

interface MiniPageRowProps {
  row: FoldRow;
  isDone: boolean;
  isActive: boolean;
  onClick: () => void;
}

function MiniPageRow({ row, isDone, isActive, onClick }: MiniPageRowProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-right
        transition-colors duration-150
        ${isActive
          ? "bg-amber-500/10 border border-amber-500/30"
          : isDone
          ? "bg-stone-800/40 border border-transparent"
          : "hover:bg-stone-800/30 border border-transparent"
        }
      `}
    >
      {/* Status dot */}
      <span
        className={`shrink-0 w-2 h-2 rounded-full ${
          isDone ? "bg-amber-400" : "bg-stone-700"
        }`}
      />
      {/* Page */}
      <span
        className={`w-8 tabular-nums text-sm font-bold ${
          isActive ? "text-amber-400" : isDone ? "text-stone-400" : "text-stone-300"
        }`}
      >
        {row.page}
      </span>
      {/* Measurements */}
      <span className="text-xs text-stone-500 flex-1">
        {row.startCm.toFixed(1)} – {row.endCm.toFixed(1)} ס"מ
      </span>
      {/* Method */}
      <span className={`text-[10px] font-medium ${
        row.method === "MMF" ? "text-sky-500" : "text-violet-500"
      }`}>
        {row.method}
      </span>
    </button>
  );
}

// ── WorkshopTracker (main export) ─────────────────────────────────────────────

export default function WorkshopTracker() {
  const rows = useDualViewStore((s) => s.rows);
  const completedPages = useDualViewStore((s) => s.completedPages);
  const togglePage = useDualViewStore((s) => s.togglePage);
  const progressPct = useDualViewStore((s) => s.progressPct);

  const { persistToggle } = useWorkshopSync();
  const [savingPage, setSavingPage] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);

  // Unique pages list (one entry per page, first row wins for display)
  const uniqueRows = React.useMemo(() => {
    const seen = new Set<number>();
    return rows.filter((r) => {
      if (seen.has(r.page)) return false;
      seen.add(r.page);
      return true;
    });
  }, [rows]);

  // Sync focus to first incomplete page on data load
  useEffect(() => {
    const firstIncomplete = uniqueRows.findIndex((r) => !completedPages.has(r.page));
    if (firstIncomplete !== -1) setFocusIdx(firstIncomplete);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentRow = uniqueRows[focusIdx];
  const pct = progressPct();

  const handleToggle = useCallback(async () => {
    if (!currentRow) return;
    const page = currentRow.page;
    const wasDone = completedPages.has(page);
    setSavingPage(page);
    togglePage(page); // optimistic local update
    await persistToggle(page, wasDone);
    setSavingPage(null);

    // Auto-advance to next incomplete page after marking done
    if (!wasDone) {
      const nextIdx = uniqueRows.findIndex(
        (r, i) => i > focusIdx && !completedPages.has(r.page) && r.page !== page
      );
      if (nextIdx !== -1) setFocusIdx(nextIdx);
    }
  }, [currentRow, completedPages, focusIdx, persistToggle, togglePage, uniqueRows]);

  const handlePrint = useCallback(async () => {
    setIsPrinting(true);
    try {
      await generateWorkshopPDF(rows, [...completedPages]);
    } finally {
      setIsPrinting(false);
    }
  }, [rows, completedPages]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-4" dir="rtl">

      {/* ── Header: logo + print button ──────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="relative h-10 w-36">
          <Image
            src="/mekapele-logo.png"
            alt="Mekapele — קיפולי ספרים"
            fill
            className="object-contain object-right"
            priority
          />
        </div>

        <button
          onClick={handlePrint}
          disabled={isPrinting || !rows.length}
          className="
            flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
            bg-stone-800 border border-stone-700 text-stone-200
            hover:bg-stone-700 active:scale-95 transition-all duration-150
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isPrinting ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              מכין...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z"
                />
              </svg>
              הדפס PDF
            </>
          )}
        </button>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <ProgressBar pct={pct} />
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!rows.length && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone-600 text-sm text-center px-8 leading-relaxed">
            העלה תמונה וצור תבנית כדי להתחיל את מצב הסדנה
          </p>
        </div>
      )}

      {/* ── Main content: FocusCard + navigation + all-pages list ─────────── */}
      {currentRow && (
        <div className="flex-1 flex flex-col gap-4 min-h-0">

          {/* Focus card */}
          <div className="shrink-0">
            <FocusCard
              row={currentRow}
              isDone={completedPages.has(currentRow.page)}
              onToggle={handleToggle}
              isSaving={savingPage === currentRow.page}
            />
          </div>

          {/* Prev / next navigation */}
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => setFocusIdx((i) => Math.max(0, i - 1))}
              disabled={focusIdx === 0}
              className="flex-1 py-2.5 rounded-xl border border-stone-700 text-sm font-medium text-stone-400
                hover:bg-stone-800 active:scale-95 transition-all disabled:opacity-30"
            >
              ← הקודם
            </button>
            <span className="flex items-center text-xs text-stone-600 tabular-nums px-2">
              {focusIdx + 1} / {uniqueRows.length}
            </span>
            <button
              onClick={() => setFocusIdx((i) => Math.min(uniqueRows.length - 1, i + 1))}
              disabled={focusIdx === uniqueRows.length - 1}
              className="flex-1 py-2.5 rounded-xl border border-stone-700 text-sm font-medium text-stone-400
                hover:bg-stone-800 active:scale-95 transition-all disabled:opacity-30"
            >
              הבא →
            </button>
          </div>

          {/* Scrollable all-pages list */}
          <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-stone-800 bg-stone-900/40">
            <div className="sticky top-0 bg-stone-900/95 backdrop-blur-sm px-3 py-2 border-b border-stone-800 z-10">
              <p className="text-[10px] uppercase tracking-widest text-stone-500 font-medium">
                כל העמודים — {completedPages.size} / {uniqueRows.length} הושלמו
              </p>
            </div>
            <div className="p-2 space-y-0.5">
              {uniqueRows.map((row, i) => (
                <MiniPageRow
                  key={row.page}
                  row={row}
                  isDone={completedPages.has(row.page)}
                  isActive={i === focusIdx}
                  onClick={() => setFocusIdx(i)}
                />
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
