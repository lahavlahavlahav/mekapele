"use client";

import { useStore } from "@/lib/store";

/** Mode 1 — Print-Ready Export: branded, cleanly formatted measurement table. */
export default function PrintExport() {
  const { pattern, setView } = useStore();
  if (!pattern) return null;

  const { config, pages } = pattern;
  const maxMarks = pages.reduce((m, p) => Math.max(m, p.marksCm.length), 0);
  const headers =
    config.mode === "MMF"
      ? ["עמוד", "עליון (ס״מ)", "תחתון (ס״מ)"]
      : ["עמוד", ...Array.from({ length: maxMarks }, (_, i) =>
          i % 2 === 0 ? `גזירה ${i / 2 + 1} מ-` : `עד`
        )];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Screen-only controls */}
      <div className="no-print flex items-center justify-between mb-6">
        <button
          onClick={() => setView("tracker")}
          className="text-sm px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--line)" }}
        >
          → חזרה למעקב
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg font-semibold text-white"
          style={{ background: "var(--coral)" }}
        >
          הדפסה / שמירה כ-PDF
        </button>
      </div>

      {/* Branded header — embedded in the printed document */}
      <div className="flex items-center gap-4 pb-4 mb-4 border-b" style={{ borderColor: "var(--ink)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/mekapele-logo.png" alt="Lilou Books" className="h-12 w-auto" />
        <div>
          <h1 className="font-display text-xl">תבנית קיפול ספר</h1>
          <p className="text-sm text-[var(--ink-soft)] tabular">
            {config.totalPages} עמודים · {pages.length} עלים · גובה עמוד{" "}
            {config.pageHeightCm} ס״מ ·{" "}
            {config.mode === "MMF" ? "סימון וקיפול" : `גזירה וקיפול (לשונית מינ׳ ${config.minTabSizeMm} מ״מ)`}{" "}
            · {config.direction}
          </p>
        </div>
      </div>

      <table className="print-table w-full text-sm tabular border-collapse">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left px-3 py-2 border"
                style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.page}>
              <td className="px-3 py-1.5 border font-semibold" style={{ borderColor: "var(--line)" }}>
                {p.page}
              </td>
              {p.isBlank ? (
                <td
                  className="px-3 py-1.5 border text-[var(--ink-soft)]"
                  style={{ borderColor: "var(--line)" }}
                  colSpan={headers.length - 1}
                >
                  — אין קיפול —
                </td>
              ) : (
                Array.from({ length: headers.length - 1 }, (_, i) => (
                  <td key={i} className="px-3 py-1.5 border" style={{ borderColor: "var(--line)" }}>
                    {p.marksCm[i] !== undefined ? p.marksCm[i].toFixed(1) : ""}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
