// =============================================================================
// CORE ALGORITHM MODULE  (Direction-Aware + Advanced Multi-layer MMF)
// -----------------------------------------------------------------------------
// Converts a binary/grayscale image into per-leaf folding measurements.
//
// Two modes:
//   • Advanced MMF (multi-layer): every distinct black segment in a sampled
//     column becomes its OWN leaf. The horizontal sampling resolution is tuned
//     by binary search so the total number of segments == totalPages / 2.
//     Segments are distributed across leaves with an alternating global pass
//     (fill odd indices first, then even, then the next stride…), so each
//     segment lands on a unique leaf with no collisions or loss.
//   • Cut & Fold: every black/white toggle in a column stays on ONE leaf;
//     runs thinner than Min Tab Size are dropped.
//
// Reading direction controls column order: LTR scans left→right (page 1 = left
// edge), RTL scans right→left (page 1 = right edge).
//
// Pure & deterministic: no DOM, no canvas — fully unit-testable.
// =============================================================================

import type {
  BookConfig,
  FoldingPattern,
  PageMeasurement,
  PixelGrid,
} from "./types";

/** Luminance at/under this value counts as "black" after thresholding. */
const BLACK_THRESHOLD = 128;

/** Round a number to exactly one decimal place (e.g. 3.04 → 3.0). */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Convert a pixel Y-coordinate into physical centimeters down the page. */
export function pixelYToCm(
  pixelY: number,
  imageHeightPixels: number,
  pageHeightCm: number
): number {
  if (imageHeightPixels <= 0) return 0;
  return round1((pixelY / imageHeightPixels) * pageHeightCm);
}

function isBlack(luminance: number): boolean {
  return luminance <= BLACK_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Column sampling
// ---------------------------------------------------------------------------

/**
 * Order the sampled column indices [0..columnCount-1] according to reading
 * direction. LTR keeps natural order (left first); RTL reverses (right first).
 */
export function orderColumnsByDirection(
  columnCount: number,
  direction: BookConfig["direction"]
): number[] {
  const order = Array.from({ length: columnCount }, (_, i) => i);
  return direction === "LTR" ? order : order.reverse();
}

/**
 * Map sampled column `col` (0-based, out of `columnCount`) to the inclusive
 * pixel-X band [startX, endX] in the source image. Equal division; the final
 * column absorbs any rounding remainder so no pixels are lost.
 */
export function sampleColumnBounds(
  width: number,
  columnCount: number,
  col: number
): { startX: number; endX: number } {
  const colWidth = width / columnCount;
  const startX = Math.floor(col * colWidth);
  const endX =
    col === columnCount - 1
      ? width - 1
      : Math.floor((col + 1) * colWidth) - 1;
  return { startX, endX: Math.max(startX, endX) };
}

/**
 * Collapse a band of columns [startX..endX] into one representative column by
 * taking the DARKEST pixel across the band at each Y — keeps thin features
 * visible even if the band's center happens to be white.
 */
function collapseColumn(
  grid: PixelGrid,
  startX: number,
  endX: number
): Uint8ClampedArray {
  const { width, height, luminance } = grid;
  const column = new Uint8ClampedArray(height);
  for (let y = 0; y < height; y++) {
    let darkest = 255;
    const row = y * width;
    for (let x = startX; x <= endX; x++) {
      const lum = luminance[row + x];
      if (lum < darkest) darkest = lum;
    }
    column[y] = darkest;
  }
  return column;
}

// ---------------------------------------------------------------------------
// Segment detection
// ---------------------------------------------------------------------------

/** A contiguous black run within a column, as pixel Y-coordinates. */
export interface Segment {
  topY: number;
  bottomY: number;
}

/**
 * Find ALL distinct black segments in a column (runs of black separated by
 * white negative space). Runs shorter than `minRunPixels` are ignored as noise
 * (defaults to 1 = keep everything).
 */
export function findSegments(
  column: Uint8ClampedArray,
  minRunPixels = 1
): Segment[] {
  const segments: Segment[] = [];
  let runStart = -1;
  for (let y = 0; y < column.length; y++) {
    const black = isBlack(column[y]);
    if (black && runStart === -1) {
      runStart = y;
    } else if (!black && runStart !== -1) {
      if (y - runStart >= minRunPixels)
        segments.push({ topY: runStart, bottomY: y - 1 });
      runStart = -1;
    }
  }
  if (runStart !== -1 && column.length - runStart >= minRunPixels) {
    segments.push({ topY: runStart, bottomY: column.length - 1 });
  }
  return segments;
}

/** Every black/white toggle in a column as [enter, exit] pixel pairs. */
function findToggles(column: Uint8ClampedArray, minRunPixels: number): number[] {
  const marks: number[] = [];
  let runStart = -1;
  for (let y = 0; y < column.length; y++) {
    const black = isBlack(column[y]);
    if (black && runStart === -1) {
      runStart = y;
    } else if (!black && runStart !== -1) {
      if (y - runStart >= minRunPixels) marks.push(runStart, y - 1);
      runStart = -1;
    }
  }
  if (runStart !== -1 && column.length - runStart >= minRunPixels) {
    marks.push(runStart, column.length - 1);
  }
  return marks;
}

// ---------------------------------------------------------------------------
// Advanced MMF: count segments at a given resolution, then binary-search it
// ---------------------------------------------------------------------------

/**
 * Total number of black segments across all columns at a given horizontal
 * resolution. Monotonic-ish and used as the objective for binary search.
 */
export function countSegmentsAtResolution(
  grid: PixelGrid,
  columnCount: number,
  direction: BookConfig["direction"]
): number {
  let total = 0;
  const order = orderColumnsByDirection(columnCount, direction);
  for (const col of order) {
    const { startX, endX } = sampleColumnBounds(grid.width, columnCount, col);
    const column = collapseColumn(grid, startX, endX);
    total += findSegments(column).length;
  }
  return total;
}

/**
 * Binary-search the horizontal resolution (number of sampled columns) so the
 * total segment count is as close as possible to `targetFolds`, preferring the
 * resolution that does not overshoot. Returns the chosen column count.
 *
 * More columns → finer sampling → generally more segments. We search column
 * counts in [1, maxColumns] for the largest count whose segment total ≤ target,
 * then check the neighbour above in case it is an exact hit.
 */
export function calibrateResolution(
  grid: PixelGrid,
  targetFolds: number,
  direction: BookConfig["direction"]
): { columnCount: number; segmentTotal: number } {
  const maxColumns = Math.max(1, grid.width);

  let lo = 1;
  let hi = maxColumns;
  let best = { columnCount: 1, segmentTotal: countSegmentsAtResolution(grid, 1, direction) };

  // Track the closest result seen, breaking ties toward not overshooting.
  const consider = (cc: number) => {
    const total = countSegmentsAtResolution(grid, cc, direction);
    const bestDist = Math.abs(best.segmentTotal - targetFolds);
    const dist = Math.abs(total - targetFolds);
    const better =
      dist < bestDist ||
      (dist === bestDist &&
        total <= targetFolds &&
        best.segmentTotal > targetFolds);
    if (better) best = { columnCount: cc, segmentTotal: total };
    return total;
  };

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const total = consider(mid);
    if (total === targetFolds) {
      return { columnCount: mid, segmentTotal: total };
    }
    if (total < targetFolds) lo = mid + 1;
    else hi = mid - 1;
  }

  // Safety net: segment count is not strictly monotonic in resolution, so the
  // binary search can miss an exact hit. If we haven't matched, sweep a set of
  // sampled resolutions for a closer (ideally exact) result.
  if (best.segmentTotal !== targetFolds) {
    const steps = Math.min(maxColumns, 256);
    for (let s = 1; s <= steps; s++) {
      const cc = Math.max(1, Math.round((s / steps) * maxColumns));
      const total = consider(cc);
      if (total === targetFolds) return { columnCount: cc, segmentTotal: total };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Alternating global distribution of segments across leaves
// ---------------------------------------------------------------------------

/**
 * Build the leaf-visiting order for `leafCount` leaves using an alternating
 * stride pattern: index 0, 2, 4, … then 1, 3, 5, … (and, if those run out for
 * larger counts, finer offsets). This realises the PRD's "N, N+2, N+4"
 * spreading globally so consecutive segments land on alternating leaves.
 *
 * Example (leafCount=6): [0,2,4, 1,3,5]  → 1-based leaves [1,3,5, 2,4,6].
 */
export function alternatingLeafOrder(leafCount: number): number[] {
  const order: number[] = [];
  for (let start = 0; start < 2 && order.length < leafCount; start++) {
    for (let i = start; i < leafCount; i += 2) order.push(i);
  }
  // Safety: if anything was missed (shouldn't be for stride 2), append rest.
  if (order.length < leafCount) {
    for (let i = 0; i < leafCount; i++) if (!order.includes(i)) order.push(i);
  }
  return order;
}

// ---------------------------------------------------------------------------
// Top-level generator
// ---------------------------------------------------------------------------

export function generateFoldingPattern(
  grid: PixelGrid,
  config: BookConfig
): FoldingPattern {
  const leafCount = Math.floor(config.totalPages / 2);
  if (leafCount < 1) throw new Error("Total Book Pages must be at least 2.");

  const pixelsPerCm = grid.height / config.pageHeightCm;
  const minTabPixels = Math.max(
    1,
    Math.round((config.minTabSizeMm / 10) * pixelsPerCm)
  );

  const pages: PageMeasurement[] =
    config.mode === "MMF"
      ? generateAdvancedMMF(grid, config, leafCount)
      : generateCutAndFold(grid, config, leafCount, minTabPixels);

  return {
    config,
    pages,
    imageWidth: grid.width,
    imageHeight: grid.height,
    generatedAt: Date.now(),
  };
}

/**
 * Advanced MMF: calibrate resolution → collect every segment in reading order
 * → distribute across leaves with the alternating global order → one segment
 * (two marks) per leaf.
 */
function generateAdvancedMMF(
  grid: PixelGrid,
  config: BookConfig,
  leafCount: number
): PageMeasurement[] {
  const { columnCount } = calibrateResolution(grid, leafCount, config.direction);

  // Gather all segments in reading-direction column order, top→bottom each.
  const segments: Segment[] = [];
  const order = orderColumnsByDirection(columnCount, config.direction);
  for (const col of order) {
    const { startX, endX } = sampleColumnBounds(grid.width, columnCount, col);
    const column = collapseColumn(grid, startX, endX);
    for (const seg of findSegments(column)) {
      if (segments.length < leafCount) segments.push(seg);
    }
    if (segments.length >= leafCount) break;
  }

  // Prepare empty leaves, then place each segment onto the alternating order.
  const pages: PageMeasurement[] = Array.from({ length: leafCount }, (_, i) => ({
    page: i + 1,
    marksCm: [],
    isBlank: true,
  }));

  const leafOrder = alternatingLeafOrder(leafCount);
  segments.forEach((seg, i) => {
    const leafIdx = leafOrder[i % leafCount];
    pages[leafIdx] = {
      page: leafIdx + 1,
      marksCm: [
        pixelYToCm(seg.topY, grid.height, config.pageHeightCm),
        pixelYToCm(seg.bottomY, grid.height, config.pageHeightCm),
      ],
      isBlank: false,
    };
  });

  return pages;
}

/**
 * Cut & Fold: one column per leaf (resolution fixed at leafCount), every toggle
 * recorded on that single leaf, gap-filtered by Min Tab Size.
 */
function generateCutAndFold(
  grid: PixelGrid,
  config: BookConfig,
  leafCount: number,
  minTabPixels: number
): PageMeasurement[] {
  const pages: PageMeasurement[] = [];
  const order = orderColumnsByDirection(leafCount, config.direction);

  for (let page = 1; page <= leafCount; page++) {
    const col = order[page - 1];
    const { startX, endX } = sampleColumnBounds(grid.width, leafCount, col);
    const column = collapseColumn(grid, startX, endX);
    const marksCm = findToggles(column, minTabPixels).map((y) =>
      pixelYToCm(y, grid.height, config.pageHeightCm)
    );
    pages.push({ page, marksCm, isBlank: marksCm.length === 0 });
  }
  return pages;
}
