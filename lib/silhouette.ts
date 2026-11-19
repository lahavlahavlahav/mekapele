// =============================================================================
// SILHOUETTE - the design redrawn from its fold marks, background-free.
// Shared by the PDF export header and the print view header.
// =============================================================================

import type { FoldingPattern } from "@/lib/types";
import { pairUp } from "@/lib/foldMap";
import { leafSourceBounds } from "@/lib/algorithm";

/**
 * The design rebuilt from its own fold marks (black bands on nothing), placed
 * at each leaf's exact source column so it looks like the uploaded image
 * minus its background. Scaled to fit maxW x maxH mm; coordinates are
 * relative to the box's top-left.
 */
export function silhouetteRects(
  pattern: FoldingPattern,
  maxW: number,
  maxH: number
): { x: number; y: number; w: number; h: number }[] {
  const { pages, config, imageHeight } = pattern;
  const pxPerCm = imageHeight / Math.max(0.1, config.verticalSpacingCm);
  const bands: { x0: number; x1: number; lo: number; hi: number }[] = [];
  pages.forEach((p, i) => {
    if (p.isBlank) return;
    const { startX, endX } = leafSourceBounds(pattern, i);
    for (const [lo, hi] of pairUp(p.marksCm)) {
      if (hi > lo) bands.push({ x0: startX, x1: endX, lo, hi });
    }
  });
  if (!bands.length) return [];
  const minX = Math.min(...bands.map((b) => b.x0));
  const maxX = Math.max(...bands.map((b) => b.x1));
  const minCm = Math.min(...bands.map((b) => b.lo));
  const maxCm = Math.max(...bands.map((b) => b.hi));
  const widthPx = Math.max(1, maxX - minX);
  const heightPx = Math.max(1, (maxCm - minCm) * pxPerCm);
  const s = Math.min(maxW / widthPx, maxH / heightPx);
  return bands.map((b) => ({
    x: (b.x0 - minX) * s,
    y: (b.lo - minCm) * pxPerCm * s,
    // A hair of overlap so adjacent columns don't show white seams.
    w: (b.x1 - b.x0) * s + 0.12,
    h: (b.hi - b.lo) * pxPerCm * s,
  }));
}
