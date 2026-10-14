"use client";

import type { PageMeasurement, ReadingDirection } from "@/lib/types";
import { foldMapRows, pairUp } from "@/lib/foldMap";

// Matches the reference layout: ~45 rows fit comfortably on one printed A4
// page at a legible row height.
const ROWS_PER_PAGE = 45;
const ROW_HEIGHT = 22;
const BAR_HEIGHT = 10;
const CHART_WIDTH = 640;
const LABEL_GUTTER = 60;
const TOP_MARGIN = 24;

/**
 * Fold Map — one horizontal ruled row per leaf, with a filled bar for every
 * marked band at its true position along the page-height axis (0cm = right
 * edge, matching "top of page at right"; deeper marks extend further left).
 * This is the same information as the measurement table, just as a visual
 * profile a folder can scan at a glance - chunked into print-page-sized
 * groups the same way the reference export does. A bold vertical rule marks
 * the top-of-page edge, and row order is direction-independent (see
 * foldMapRows).
 */
export default function FoldMapChart({
  pages,
  pageHeightCm,
  direction,
}: {
  pages: PageMeasurement[];
  pageHeightCm: number;
  direction: ReadingDirection;
}) {
  const rows = foldMapRows(pages, direction);
  const chunks: PageMeasurement[][] = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
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
                Top of page at right (bold line = top edge)
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
              <line
                x1={CHART_WIDTH}
                y1={TOP_MARGIN - ROW_HEIGHT / 2}
                x2={CHART_WIDTH}
                y2={TOP_MARGIN + (chunk.length - 1) * ROW_HEIGHT + ROW_HEIGHT / 2}
                stroke="var(--ink)"
                strokeWidth={4}
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
