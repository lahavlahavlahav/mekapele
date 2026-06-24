"use client";

import type { FoldingMode, PageMeasurement } from "@/lib/types";

interface FocusCardProps {
  measurement: PageMeasurement;
  totalLeaves: number;
  mode: FoldingMode;
}

/**
 * Focus Mode: the single page being folded right now, in large, glanceable
 * typography. MMF shows a top/bottom mark pair; Cut & Fold shows cut pairs.
 */
export default function FocusCard({
  measurement,
  totalLeaves,
  mode,
}: FocusCardProps) {
  const { page, marksCm, isBlank } = measurement;

  // Group marks into pairs for readable presentation.
  const pairs: [number, number | null][] = [];
  for (let i = 0; i < marksCm.length; i += 2) {
    pairs.push([marksCm[i], marksCm[i + 1] ?? null]);
  }

  return (
    <div
      className="rounded-[var(--radius)] p-6 sm:p-8 text-center"
      style={{ background: "var(--ink)", boxShadow: "var(--shadow)" }}
    >
      <p className="eyebrow" style={{ color: "rgba(246,241,231,0.6)" }}>
        Now folding
      </p>
      <div className="mt-1 flex items-baseline justify-center gap-3">
        <span className="font-display text-7xl sm:text-8xl text-[var(--paper)] tabular leading-none">
          {page}
        </span>
        <span className="text-lg text-[rgba(246,241,231,0.55)] tabular">
          / {totalLeaves}
        </span>
      </div>

      {isBlank ? (
        <p className="mt-6 text-xl text-[rgba(246,241,231,0.8)]">
          No fold on this leaf — turn the page.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {pairs.map(([a, b], i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-4 sm:gap-6"
            >
              {mode === "CUT_AND_FOLD" && pairs.length > 1 && (
                <span className="eyebrow w-6 text-right" style={{ color: "rgba(246,241,231,0.45)" }}>
                  {i + 1}
                </span>
              )}
              <Mark label={mode === "MMF" ? "Top" : "Cut from"} value={a} />
              {b !== null && (
                <>
                  <span className="text-[var(--coral)] text-2xl">→</span>
                  <Mark label={mode === "MMF" ? "Bottom" : "Cut to"} value={b} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Mark({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[5.5rem]">
      <div className="font-display text-5xl sm:text-6xl text-[var(--paper)] tabular leading-none">
        {value.toFixed(1)}
        <span className="text-xl text-[rgba(246,241,231,0.5)] ml-1">cm</span>
      </div>
      <div
        className="eyebrow mt-1"
        style={{ color: "rgba(246,241,231,0.5)" }}
      >
        {label}
      </div>
    </div>
  );
}
