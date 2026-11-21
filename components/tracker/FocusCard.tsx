"use client";

import type { FoldingMode, PageMeasurement } from "@/lib/types";
import InfoTip from "../ui/InfoTip";

interface FocusCardProps {
  measurement: PageMeasurement;
  /** The book's actual last physical page number (config.lastPage) - `measurement.page` is also a physical page number, so the "X / Y" ratio must use the same unit, not the leaf count. */
  lastPage: number;
  mode: FoldingMode;
  isFolded: boolean;
  onToggleFold: () => void;
}

/**
 * Focus Mode: the single page being folded right now, in large, glanceable
 * typography. MMF shows one top/bottom mark pair per fold line (2-3 for
 * Multiline MMF); Cut & Fold shows cut pairs; PAINT shows painted bands.
 */
export default function FocusCard({
  measurement,
  lastPage,
  mode,
  isFolded,
  onToggleFold,
}: FocusCardProps) {
  const { page, marksCm, isBlank } = measurement;

  // Group marks into pairs for readable presentation.
  const pairs: [number, number | null][] = [];
  for (let i = 0; i < marksCm.length; i += 2) {
    pairs.push([marksCm[i], marksCm[i + 1] ?? null]);
  }

  // The card must fit on screen without scrolling, however many cuts a leaf
  // has (photo line art can give 15-20 pairs). Few pairs keep the big,
  // glanceable numbers; more pairs switch to a compact table, two columns
  // when it would otherwise get tall.
  const n = pairs.length;
  const big = n <= 2;
  const twoCols = n > 8;
  const valueClass = n <= 4 ? "text-4xl" : n <= 8 ? "text-2xl" : "text-lg";
  const fromLabel = mode === "MMF" ? "עליון" : mode === "PAINT" ? "צביעה מ-" : "גזירה מ-";
  const toLabel = mode === "MMF" ? "תחתון" : mode === "PAINT" ? "צביעה עד" : "גזירה עד";
  const rowLabel = (i: number) => (mode === "MMF" ? `קו ${i + 1}` : String(i + 1));

  return (
    <div
      className={`relative rounded-[var(--radius)] text-center ${big ? "p-6 sm:p-8" : "p-4 sm:p-5"}`}
      style={{ background: "var(--ink)", boxShadow: "var(--shadow)" }}
    >
      {/* Pinned to the dark card's own top-right corner (not the page header),
          so it stays right next to "מקפלים עכשיו" and its position is fixed
          relative to the card regardless of how tall the card grows below. */}
      <button
        onClick={onToggleFold}
        className="absolute top-3 right-3 text-sm px-3 py-1.5 rounded-lg font-semibold"
        style={
          isFolded
            ? { background: "var(--sage)", color: "#fff" }
            : { background: "var(--coral)", color: "#fff" }
        }
      >
        {isFolded ? "✓ קיפלתי" : "קיפלתי"}
      </button>

      <p className="eyebrow inline-flex items-center gap-1.5" style={{ color: "rgba(246,241,231,0.6)" }}>
        מקפלים עכשיו
        <InfoTip
          text={
            mode === "MMF"
              ? "המספר הגדול הוא מספר העמוד בספר. 'עליון' ו'תחתון' הם המרחק בס״מ מהקצה העליון של הדף: מסמנים את שתי הנקודות בעיפרון ומקפלים את הפינות פנימה בדיוק בסימונים."
              : mode === "PAINT"
              ? "המספר הגדול הוא מספר העמוד בספר. כל זוג 'צביעה מ- / עד' הוא קטע בס״מ מהקצה העליון של הדף: מסמנים את שתי הנקודות וצובעים את קצה הדף ביניהן בצבע שבחרתם."
              : "המספר הגדול הוא מספר העמוד בספר. כל זוג 'גזירה מ- / עד' הוא קטע בס״מ מהקצה העליון של הדף: גוזרים בכל סימון ומקפלים את הלשוניות לסירוגין."
          }
        />
      </p>
      <div className="mt-1 flex items-baseline justify-center gap-3">
        <span
          className={`font-display text-[var(--paper)] tabular leading-none ${big ? "text-7xl sm:text-8xl" : "text-5xl sm:text-6xl"}`}
        >
          {page}
        </span>
        <span className="text-lg text-[rgba(246,241,231,0.55)] tabular">
          / {lastPage}
        </span>
      </div>

      {isBlank ? (
        <p className="mt-6 text-xl text-[rgba(246,241,231,0.8)]">
          אין סימונים בדף זה — דלג.
        </p>
      ) : big ? (
        <div className="mt-6 space-y-3">
          {pairs.map(([a, b], i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-4 sm:gap-6"
            >
              {pairs.length > 1 && (
                <span className="eyebrow w-10 text-right" style={{ color: "rgba(246,241,231,0.45)" }}>
                  {rowLabel(i)}
                </span>
              )}
              <Mark label={fromLabel} value={a} />
              {b !== null && <Mark label={toLabel} value={b} />}
            </div>
          ))}
        </div>
      ) : (
        <div className={`mt-4 grid gap-x-5 ${twoCols ? "grid-cols-2" : "grid-cols-1"}`}>
          {(twoCols ? [pairs.slice(0, Math.ceil(n / 2)), pairs.slice(Math.ceil(n / 2))] : [pairs]).map((col, c) => (
            <table key={c} className="w-full tabular text-[var(--paper)]">
              <thead>
                <tr className="eyebrow" style={{ color: "rgba(246,241,231,0.5)" }}>
                  <th className="font-normal w-6" />
                  <th className="font-normal">{fromLabel}</th>
                  <th className="font-normal">{toLabel.replace("גזירה ", "").replace("צביעה ", "")}</th>
                </tr>
              </thead>
              <tbody>
                {col.map(([a, b], j) => {
                  const i = c * Math.ceil(n / 2) + j;
                  return (
                    <tr key={i} className="border-t" style={{ borderColor: "rgba(246,241,231,0.12)" }}>
                      <td className="text-xs py-0.5" style={{ color: "rgba(246,241,231,0.45)" }}>
                        {i + 1}
                      </td>
                      <td className={`font-display leading-tight py-0.5 ${valueClass}`}>{a.toFixed(1)}</td>
                      <td className={`font-display leading-tight py-0.5 ${valueClass}`}>{b !== null ? b.toFixed(1) : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
          <p className="col-span-full mt-2 text-xs" style={{ color: "rgba(246,241,231,0.45)" }}>
            כל המידות בס״מ מהקצה העליון של הדף
          </p>
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
        <span className="text-xl text-[rgba(246,241,231,0.5)] mr-1">ס״מ</span>
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
