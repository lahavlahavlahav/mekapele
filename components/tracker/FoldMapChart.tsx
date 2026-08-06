"use client";

import type { PageMeasurement } from "@/lib/types";

// Matches the reference layout: ~45 rows fit comfortably on one printed A4
// page at a legible row height.
const ROWS_PER_PAGE = 45;
const ROW_HEIGHT = 22;
const BAR_HEIGHT = 10;
const CHART_WIDTH = 640;
const LABEL_GUTTER = 60;
const TOP_MARGIN = 24;

/** [start, end] pairs (order-independent) from a leaf's flat marksCm array. */
function pairUp(marksCm: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < marksCm.length; i += 2) {
    pairs.push([Math.min(marksCm[i], marksCm[i + 1]), Math.max(marksCm[i], marksCm[i + 1])]);
  }
  return pairs;
}

/**
 * Fold Map — one horizontal ruled row per leaf, with a filled bar for every
 * marked band at its true position along the page-height axis (0cm = right
 * edge, matching "top of page at right"; deeper marks extend further left).
 * This is the same information as the measurement table, just as a visual
 * profile a folder can scan at a glance - chunked into print-page-sized
 * groups the same way the reference export does.
 */
export default function FoldMapChart({
  pages,
  pageHeightCm,
}: {
  pages: PageMeasurement[];
  pageHeightCm: number;
}) {
  const chunks: PageMeasurement[][] = [];
  for (let i = 0; i < pages.length; i += ROWS_PER_PAGE) {
    chunks.push(pages.slice(i, i + ROWS_PER_PAGE));
  }

  const cmToX = (cm: number) => CHART_WIDTH - (cm / pageHeightCm) * CHART_WIDTH;
  const width = CHART_WIDTH + LABEL_GUTTER;

  return (
    <div className="space-y-8">
      {chunks.map((chunk, ci) => {
        const height = TOP_MARGIN + chunk.length * ROW_HEIGHT + 10;
        return (
          <div key={ci} className="fold-map-page">
            <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="block">
              <text x={width} y={12} textAnchor="end" fontSize={11} fill="var(--ink-soft)">
                Top of page at right
              </text>
              {chunk.map((p, i) => {
                const y = TOP_MARGIN + i * ROW_HEIGHT;
                return (
                  <g key={p.leaf}>
                    <line x1={0} y1={y} x2={CHART_WIDTH} y2={y} stroke="var(--line)" strokeWidth={1} />
                    {pairUp(p.marksCm).map(([lo, hi], k) => {
                      const x1 = cmToX(hi);
                      const x2 = cmToX(lo);
                      return (
                        <rect
                          key={k}
                          x={x1}
                          y={y - BAR_HEIGHT / 2}
                          width={Math.max(1, x2 - x1)}
                          height={BAR_HEIGHT}
                          fill="var(--ink)"
                        />
                      );
                    })}
                    <text x={width} y={y + 4} textAnchor="end" fontSize={11} fill="var(--ink)">
                      {p.page}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
