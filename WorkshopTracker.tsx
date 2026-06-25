"use client";
// =============================================================================
// components/WorkshopTracker.tsx
// -----------------------------------------------------------------------------
// Mobile-first workshop companion.
//
// Features:
//   • Brand logo top-center.
//   • Global progress bar (completed / total pages × 100).
//   • Step-by-step cards — one page at a time.
//   • "Mark as done" toggle per page.
//   • "Print to PDF" using jsPDF — logo on every page header.
//   • Firestore real-time sync of completion state (requires Firebase auth).
// =============================================================================

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useViewStore, type FoldRow } from "@/lib/viewStore";

// ── jsPDF (client-only dynamic import) ───────────────────────────────────────
async function generatePDF(
  rows: FoldRow[],
  completed: Record<number, boolean>,
  logoDataUrl: string | null
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const LOGO_H = 14;
  const LOGO_W = 48;
  const MARGIN = 14;

  const addHeader = (pageNum: number) => {
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", MARGIN, 8, LOGO_W, LOGO_H);
    } else {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("MEKAPELE", MARGIN, 16);
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Book Folding Pattern — Page ${pageNum} of ${doc.getNumberOfPages()}`,
      pageW - MARGIN,
      16,
      { align: "right" }
    );
    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 24, pageW - MARGIN, 24);
  };

  const body = rows.map((r) => [
    String(r.page),
    r.type,
    `${r.from.toFixed(1)} cm`,
    `${r.to.toFixed(1)} cm`,
    completed[r.page] ? "✓" : "",
  ]);

  autoTable(doc, {
    head: [["Page", "Type", "From (cm)", "To (cm)", "Done"]],
    body,
    startY: 28,
    margin: { left: MARGIN, right: MARGIN },
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [252, 211, 77],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: (data) => {
      addHeader(data.pageNumber);
    },
  });

  doc.save("mekapele-pattern.pdf");
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full px-4 pt-3 pb-1">
      <div className="flex justify-between text-xs font-medium text-slate-500 mb-1.5">
        <span>Progress</span>
        <span className="text-amber-500 font-bold">{pct}%</span>
      </div>
      <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

// ── Single fold card ──────────────────────────────────────────────────────────
interface FoldCardProps {
  row: FoldRow;
  done: boolean;
  current: boolean;
  onToggle: () => void;
}

function FoldCard({ row, done, current, onToggle }: FoldCardProps) {
  return (
    <article
      className={[
        "flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all duration-200 select-none",
        current && !done
          ? "border-amber-400 bg-amber-50 shadow-md shadow-amber-100"
          : done
          ? "border-emerald-200 bg-emerald-50"
          : "border-stone-200 bg-white",
      ].join(" ")}
    >
      {/* Page badge */}
      <div
        className={[
          "flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center",
          done
            ? "bg-emerald-500 text-white"
            : current
            ? "bg-amber-400 text-slate-900"
            : "bg-stone-100 text-slate-500",
        ].join(" ")}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">
          p.
        </span>
        <span className="text-lg font-black leading-none">{row.page}</span>
      </div>

      {/* Measurements */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">
          {row.type}
        </p>
        <p className="text-slate-800 font-semibold text-sm leading-snug">
          {row.from.toFixed(1)} cm
          <span className="mx-1.5 text-slate-300">→</span>
          {row.to.toFixed(1)} cm
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Height: {Math.abs(row.to - row.from).toFixed(1)} cm
        </p>
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        aria-label={done ? "Mark as pending" : "Mark as completed"}
        className={[
          "flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-150 active:scale-95",
          done
            ? "border-emerald-400 bg-emerald-400 text-white"
            : "border-stone-300 text-transparent hover:border-amber-400",
        ].join(" ")}
      >
        {/* Checkmark SVG */}
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-5.121-5.121a1 1 0 111.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </article>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-stone-100 flex items-center justify-center">
        <svg
          className="w-9 h-9 text-stone-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.966 8.966 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
      </div>
      <h3 className="text-slate-700 font-semibold text-base">No pattern yet</h3>
      <p className="text-slate-400 text-sm max-w-xs">
        Upload an image and generate a pattern — your fold instructions will appear here.
      </p>
    </div>
  );
}

// ── Firestore sync hook ───────────────────────────────────────────────────────
// Lazy-imports Firebase to avoid SSR issues.
function useFirestoreSync(
  userId: string | null,
  projectId: string | null,
  completed: Record<number, boolean>,
  onRemoteUpdate: (c: Record<number, boolean>) => void
) {
  useEffect(() => {
    if (!userId || !projectId) return;

    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const { getFirestore, doc, onSnapshot, setDoc } = await import(
          "firebase/firestore"
        );
        const { getApp } = await import("firebase/app");

        const db = getFirestore(getApp());
        const ref = doc(db, "users", userId, "projects", projectId);

        // Push local state immediately.
        await setDoc(ref, { completed, updatedAt: Date.now() }, { merge: true });

        // Subscribe to remote changes (multi-device sync).
        unsubscribe = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.completed) {
              onRemoteUpdate(data.completed as Record<number, boolean>);
            }
          }
        });
      } catch (err) {
        // Firebase not configured — silently degrade to local-only mode.
        console.warn("[WorkshopTracker] Firestore unavailable:", err);
      }
    })();

    return () => unsubscribe?.();
  }, [userId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Public export ─────────────────────────────────────────────────────────────
export default function WorkshopTracker() {
  const rows = useViewStore((s) => s.rows);
  const completed = useViewStore((s) => s.completed);
  const toggleCompleted = useViewStore((s) => s.toggleCompleted);
  const pct = useViewStore((s) => s.progressPct());

  // Current card = first non-completed page.
  const currentPage = rows.find((r) => !completed[r.page])?.page ?? null;

  // PDF loading state.
  const [pdfLoading, setPdfLoading] = useState(false);

  // Logo data URL (converted once for jsPDF embed).
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = "/mekapele-logo.png";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      setLogoDataUrl(canvas.toDataURL("image/png"));
    };
  }, []);

  const handlePrint = useCallback(async () => {
    if (rows.length === 0) return;
    setPdfLoading(true);
    try {
      await generatePDF(rows, completed, logoDataUrl);
    } finally {
      setPdfLoading(false);
    }
  }, [rows, completed, logoDataUrl]);

  // ── Firestore sync ─────────────────────────────────────────────────────────
  // In a real app, pull userId + projectId from an auth context / query param.
  // Gracefully degrades when neither is available.
  const [userId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("mekapele_uid") : null
  );
  const [projectId] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("mekapele_pid") : null
  );

  useFirestoreSync(userId, projectId, completed, (remote) => {
    // Merge remote into local — remote wins on conflict.
    Object.entries(remote).forEach(([page, val]) => {
      if (!!val !== !!completed[Number(page)]) {
        toggleCompleted(Number(page));
      }
    });
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] bg-stone-50">
      {/* ── Header: logo + action bar ──────────────────────────────────── */}
      <div className="bg-white border-b border-stone-200 shadow-sm">
        {/* Logo */}
        <div className="flex justify-center pt-4 pb-2 px-4">
          <div className="relative h-10 w-44">
            <Image
              src="/mekapele-logo.png"
              alt="Mekapele"
              fill
              className="object-contain object-center"
              priority
            />
          </div>
        </div>

        {/* Progress bar */}
        {rows.length > 0 && <ProgressBar pct={pct} />}

        {/* Action bar */}
        {rows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-slate-600">
                {rows.filter((r) => completed[r.page]).length}
              </span>
              {" / "}
              {rows.length} pages folded
            </p>

            <button
              onClick={handlePrint}
              disabled={pdfLoading}
              className="flex items-center gap-2 bg-slate-900 text-amber-400 text-sm font-semibold px-4 py-2 rounded-full hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait"
            >
              {pdfLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
                  </svg>
                  Building…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v5a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9a1 1 0 100 2 1 1 0 000-2zm2 1h6v3H8v-3z" clipRule="evenodd" />
                  </svg>
                  Print to PDF
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Fold list ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 pb-10">
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          rows.map((row) => (
            <FoldCard
              key={row.page}
              row={row}
              done={!!completed[row.page]}
              current={row.page === currentPage}
              onToggle={() => toggleCompleted(row.page)}
            />
          ))
        )}

        {/* All-done celebration */}
        {rows.length > 0 && pct === 100 && (
          <div className="text-center py-6">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-emerald-600 font-bold text-base">All pages folded!</p>
            <p className="text-slate-400 text-sm mt-0.5">Your book is ready.</p>
          </div>
        )}
      </div>
    </div>
  );
}
