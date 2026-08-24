"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import FoldMapChart from "./tracker/FoldMapChart";

/** Mode 1 — Print-Ready Export: branded table, or a visual fold-map chart. */
export default function PrintExport() {
  const { pattern, setView } = useStore();
  const [layout, setLayout] = useState<"table" | "map">("table");
  if (!pattern) return null;

  const { config, pages } = pattern;
  const maxMarks = pages.reduce((m, p) => Math.max(m, p.marksCm.length), 0);
  const headers =
    config.mode === "MMF"
      ? ["עלה", "עמוד", "עליון (ס״מ)", "תחתון (ס״מ)"]
      : ["עלה", "עמוד", ...Array.from({ length: maxMarks }, (_, i) =>
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
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)" }}>
            <button
              onClick={() => setLayout("table")}
              className="px-3 py-1.5 text-sm font-semibold"
              style={
                layout === "table"
                  ? { background: "var(--ink)", color: "#fff" }
                  : { background: "var(--paper)" }
              }
            >
              טבלה
            </button>
            <button
              onClick={() => setLayout("map")}
              className="px-3 py-1.5 text-sm font-semibold"
              style={
                layout === "map"
                  ? { background: "var(--ink)", color: "#fff" }
                  : { background: "var(--paper)" }
              }
            >
              מפת קיפולים
            </button>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg font-semibold text-white"
            style={{ background: "var(--coral)" }}
          >
            הדפסה / שמירה כ-PDF
          </button>
        </div>
      </div>

      {/* Branded header — embedded in the printed document */}
      <div className="flex items-center gap-4 pb-4 mb-4 border-b" style={{ borderColor: "var(--ink)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/mekapele-logo.png" alt="Lilou Books" className="h-12 w-auto" />
        <div>
          <h1 className="font-display text-xl">תבנית קיפול ספר</h1>
          <p className="text-sm text-[var(--ink-soft)] tabular">
            עמודים {config.firstPage}–{config.lastPage} · {pages.length} עלים · גובה עמוד{" "}
            {config.pageHeightCm} ס״מ · מרווח אנכי {config.verticalSpacingCm} ס״מ ·{" "}
            {config.mode === "MMF" ? "סימון וקיפול" : `גזירה וקיפול (לשונית מינ׳ ${config.minTabSizeMm} מ״מ)`}{" "}
            · {config.direction}
          </p>
        </div>
      </div>

      {layout === "table" ? (
        // Cut & Fold can put a couple dozen marks on one busy leaf, each its
        // own column. `w-full` used to force that many columns into the
        // container width, squeezing each one until autotable-style text
        // wrapped mid-number. `overflow-x-auto` + `nowrap` let the table
        // grow as wide as it needs instead - every column stays wide enough
        // for a whole number on one line, and it simply scrolls (or, when
        // printed, shrinks to fit the page) rather than wrapping.
        <div className="overflow-x-auto">
          <table className="print-table text-sm tabular border-collapse" style={{ whiteSpace: "nowrap" }}>
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="text-center px-3 py-2 border"
                    style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.leaf}>
                  <td className="px-3 py-1.5 border font-semibold" style={{ borderColor: "var(--line)" }}>
                    {p.leaf}
                  </td>
                  <td className="px-3 py-1.5 border" style={{ borderColor: "var(--line)" }}>
                    {p.page}
                  </td>
                  {p.isBlank ? (
                    <td
                      className="px-3 py-1.5 border text-center text-[var(--ink-soft)]"
                      style={{ borderColor: "var(--line)" }}
                      colSpan={headers.length - 2}
                    >
                      — אין קיפול —
                    </td>
                  ) : (
                    Array.from({ length: headers.length - 2 }, (_, i) => (
                      <td key={i} className="px-3 py-1.5 border text-center" style={{ borderColor: "var(--line)" }}>
                        {p.marksCm[i] !== undefined ? p.marksCm[i].toFixed(1) : ""}
                      </td>
                    ))
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <FoldMapChart pages={pages} pageHeightCm={config.pageHeightCm} />
      )}
    </div>
  );
}
