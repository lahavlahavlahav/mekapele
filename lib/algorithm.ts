// =============================================================================
// CORE ALGORITHM MODULE  (Direction-Aware MMF + Cut & Fold)
// -----------------------------------------------------------------------------
// Converts a binary/grayscale image into per-leaf folding measurements.
//
// Two modes:
//   • MMF (Measure, Mark, Fold): one image column per leaf. If the column has
//     a single black run, its [top, bottom] is the leaf's mark pair. If the
//     column has multiple disconnected black runs (e.g. two strokes of a
//     letter), the leaf rotates through them in top-to-bottom order as the
//     scan advances, so each run gets shown on some leaf rather than always
//     picking the same one and silently dropping the rest.
//   • Cut & Fold: every black/white toggle in a column stays on ONE leaf;
//     runs thinner than Min Tab Size are dropped.
//
// Reading direction controls column order: LTR scans left→right (page 1 = left
// edge), RTL scans right→left (page 1 = right edge).
//
// Pixel→cm mapping fits the source image into pageWidthCm x pageHeightCm
// preserving its aspect ratio (never stretched) and centers it vertically -
// matching how reference book-folding tools lay out the pattern.
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

/**
 * Convert a pixel Y-coordinate into physical centimeters down the page.
 *
 * The image is fit ("contain") into pageWidthCm x pageHeightCm, preserving
 * its aspect ratio, then centered vertically. This matches reference tools:
 * the image is never stretched to fill the full page height.
 */
export function pixelYToCm(
  pixelY: number,
  imageWidthPixels: number,
  imageHeightPixels: number,
  pageWidthCm: number,
  pageHeightCm: number
): number {
  if (imageWidthPixels <= 0 || imageHeightPixels <= 0) return 0;
  const scale = Math.min(
    pageWidthCm / imageWidthPixels,
    pageHeightCm / imageHeightPixels
  );
  const renderedHeightCm = imageHeightPixels * scale;
  const topMarginCm = (pageHeightCm - renderedHeightCm) / 2;
  return round1(topMarginCm + pixelY * scale);
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
// Top-level generator
// ---------------------------------------------------------------------------

export function generateFoldingPattern(
  grid: PixelGrid,
  config: BookConfig
): FoldingPattern {
  // Active folding range → number of leaves. Leaves run from firstPage to
  // lastPage inclusive, every other physical page (front/back of a sheet).
  const first = Math.min(config.firstPage, config.lastPage);
  const last = Math.max(config.firstPage, config.lastPage);
  const leafCount = Math.max(1, Math.floor((last - first) / 2) + 1);

  const scale = Math.min(
    config.pageWidthCm / grid.width,
    config.pageHeightCm / grid.height
  );
  const pixelsPerCm = scale > 0 ? 1 / scale : 0;
  const minTabPixels = Math.max(
    1,
    Math.round((config.minTabSizeMm / 10) * pixelsPerCm)
  );

  const pages: PageMeasurement[] =
    config.mode === "MMF"
      ? generateMMF(grid, config, leafCount, first)
      : generateCutAndFold(grid, config, leafCount, minTabPixels, first);

  return {
    config,
    pages,
    imageWidth: grid.width,
    imageHeight: grid.height,
    generatedAt: Date.now(),
  };
}

/** Map a leaf index (0-based) within the active range to its book page number. */
function leafToPageNumber(leafIndex: number, firstPage: number): number {
  // Consecutive leaves advance the physical page by 2 (front/back of a sheet).
  return firstPage + leafIndex * 2;
}

/**
 * MMF (Measure, Mark, Fold). One image column per leaf, sampled 1:1 (leaf i
 * reads column i of the active range - no separate resolution search).
 *
 *   • 0 black segments  → blank leaf.
 *   • 1 black segment   → its [top, bottom] is the mark pair.
 *   • 2+ black segments → the column has more than one stroke passing
 *     through it (e.g. two disconnected shapes). Showing only one strand
 *     forever would silently erase the others, so the leaf rotates through
 *     the segments (top-to-bottom order) as the scan advances, keyed by the
 *     leaf's position: segments[leafIndex % segments.length]. This matches
 *     reference output closely but is a best-effort heuristic for the
 *     multi-segment case - see ALGORITHM_NOTES.md for the calibration
 *     methodology and known residual mismatch rate if this needs revisiting.
 */
function generateMMF(
  grid: PixelGrid,
  config: BookConfig,
  leafCount: number,
  firstPage: number
): PageMeasurement[] {
  const order = orderColumnsByDirection(leafCount, config.direction);
  const pages: PageMeasurement[] = [];

  for (let i = 0; i < leafCount; i++) {
    const col = order[i];
    const { startX, endX } = sampleColumnBounds(grid.width, leafCount, col);
    const column = collapseColumn(grid, startX, endX);
    const segments = findSegments(column);

    let marksCm: number[] = [];
    if (segments.length > 0) {
      const chosen = segments[i % segments.length];
      marksCm = [
        pixelYToCm(chosen.topY, grid.width, grid.height, config.pageWidthCm, config.pageHeightCm),
        pixelYToCm(chosen.bottomY, grid.width, grid.height, config.pageWidthCm, config.pageHeightCm),
      ];
    }

    pages.push({
      leaf: i + 1,
      page: leafToPageNumber(i, firstPage),
      marksCm,
      isBlank: marksCm.length === 0,
    });
  }

  return pages;
}

/**
 * Cut & Fold (MMCF): one column per leaf; EVERY black/white transition in that
 * column is recorded on the SAME leaf (4, 6, or more marks allowed), gap-
 * filtered by Min Tab Size.
 */
function generateCutAndFold(
  grid: PixelGrid,
  config: BookConfig,
  leafCount: number,
  minTabPixels: number,
  firstPage: number
): PageMeasurement[] {
  const pages: PageMeasurement[] = [];
  const order = orderColumnsByDirection(leafCount, config.direction);

  for (let i = 0; i < leafCount; i++) {
    const col = order[i];
    const { startX, endX } = sampleColumnBounds(grid.width, leafCount, col);
    const column = collapseColumn(grid, startX, endX);
    const marksCm = findToggles(column, minTabPixels).map((y) =>
      pixelYToCm(y, grid.width, grid.height, config.pageWidthCm, config.pageHeightCm)
    );
    pages.push({
      leaf: i + 1,
      page: leafToPageNumber(i, firstPage),
      marksCm,
      isBlank: marksCm.length === 0,
    });
  }
  return pages;
}
