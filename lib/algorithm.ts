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
// Pixel→cm mapping renders the image at verticalSpacingCm tall (native aspect
// ratio, never stretched) and centers it within pageHeightCm - matching how
// reference book-folding tools lay out the pattern.
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
const DEFAULT_BLACK_THRESHOLD = 128;

/** Round a number to exactly one decimal place (e.g. 3.04 → 3.0). Kept for callers that don't need configurable precision. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Round to the nearest multiple of `precisionMm` (converted to cm). */
export function roundToPrecision(value: number, precisionMm: number): number {
  const stepCm = precisionMm / 10;
  if (stepCm <= 0) return value;
  const rounded = Math.round(value / stepCm) * stepCm;
  // Clean up float division artifacts (e.g. 6.800000000000001) - precision
  // is never finer than 0.1mm, so 6 decimal places is ample headroom.
  return Math.round(rounded * 1e6) / 1e6;
}

/**
 * Convert a pixel Y-coordinate into physical centimeters down the page.
 *
 * The image is rendered at verticalSpacingCm tall (native aspect ratio,
 * never stretched) and centered within pageHeightCm.
 */
export function pixelYToCm(
  pixelY: number,
  imageHeightPixels: number,
  verticalSpacingCm: number,
  pageHeightCm: number,
  precisionMm = 1
): number {
  if (imageHeightPixels <= 0) return 0;
  const scale = verticalSpacingCm / imageHeightPixels;
  const topMarginCm = (pageHeightCm - verticalSpacingCm) / 2;
  return roundToPrecision(topMarginCm + pixelY * scale, precisionMm);
}

function isBlack(luminance: number, threshold: number): boolean {
  return luminance <= threshold;
}

// ---------------------------------------------------------------------------
// Thresholding
// ---------------------------------------------------------------------------

/**
 * Otsu's method: pick the luminance threshold that maximizes between-class
 * variance of the resulting black/white split. Used when autoThreshold is on,
 * instead of a fixed cutoff — handles scans that are lighter/darker than a
 * clean black-on-white silhouette.
 */
export function computeOtsuThreshold(luminance: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < luminance.length; i++) histogram[luminance[i]]++;

  const total = luminance.length;
  if (total === 0) return DEFAULT_BLACK_THRESHOLD;

  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * histogram[t];

  let sumB = 0;
  let weightB = 0;
  let maxVariance = 0;
  let threshold = DEFAULT_BLACK_THRESHOLD;

  for (let t = 0; t < 256; t++) {
    weightB += histogram[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;

    sumB += t * histogram[t];
    const meanB = sumB / weightB;
    const meanF = (sumAll - sumB) / weightF;
    const variance = weightB * weightF * (meanB - meanF) * (meanB - meanF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
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
 * pixel-X band [startX, endX] within a region of the given `width`, starting
 * at `offsetX` in the source image. Equal division; the final column absorbs
 * any rounding remainder so no pixels are lost.
 */
export function sampleColumnBounds(
  width: number,
  columnCount: number,
  col: number,
  offsetX = 0
): { startX: number; endX: number } {
  const colWidth = width / columnCount;
  const startX = offsetX + Math.floor(col * colWidth);
  const endX =
    col === columnCount - 1
      ? offsetX + width - 1
      : offsetX + Math.floor((col + 1) * colWidth) - 1;
  return { startX, endX: Math.max(startX, endX) };
}

/**
 * Content bounding box on the X axis: the leftmost/rightmost columns that
 * contain any pixel at or under `threshold`. Falls back to the full width if
 * the image has no black pixels at all.
 */
export function computeContentBoundsX(
  grid: PixelGrid,
  threshold: number
): { startX: number; width: number } {
  const { width, height, luminance } = grid;
  let minX = width;
  let maxX = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (luminance[row + x] <= threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxX < minX) return { startX: 0, width };
  return { startX: minX, width: maxX - minX + 1 };
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
  threshold: number,
  minRunPixels = 1
): Segment[] {
  const segments: Segment[] = [];
  let runStart = -1;
  for (let y = 0; y < column.length; y++) {
    const black = isBlack(column[y], threshold);
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
function findToggles(
  column: Uint8ClampedArray,
  threshold: number,
  minRunPixels: number
): number[] {
  const marks: number[] = [];
  let runStart = -1;
  for (let y = 0; y < column.length; y++) {
    const black = isBlack(column[y], threshold);
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

  const threshold = config.autoThreshold
    ? computeOtsuThreshold(grid.luminance)
    : DEFAULT_BLACK_THRESHOLD;

  const { startX: cropStartX, width: cropWidth } = config.cropSides
    ? computeContentBoundsX(grid, threshold)
    : { startX: 0, width: grid.width };

  const pixelsPerCm =
    config.verticalSpacingCm > 0 ? grid.height / config.verticalSpacingCm : 0;
  const minTabPixels = Math.max(
    1,
    Math.round((config.minTabSizeMm / 10) * pixelsPerCm)
  );

  const pages: PageMeasurement[] =
    config.mode === "MMF"
      ? generateMMF(grid, config, leafCount, first, threshold, cropStartX, cropWidth)
      : generateCutAndFold(
          grid,
          config,
          leafCount,
          minTabPixels,
          first,
          threshold,
          cropStartX,
          cropWidth
        );

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
  firstPage: number,
  threshold: number,
  cropStartX: number,
  cropWidth: number
): PageMeasurement[] {
  const order = orderColumnsByDirection(leafCount, config.direction);
  const pages: PageMeasurement[] = [];

  for (let i = 0; i < leafCount; i++) {
    const col = order[i];
    const { startX, endX } = sampleColumnBounds(cropWidth, leafCount, col, cropStartX);
    const column = collapseColumn(grid, startX, endX);
    const segments = findSegments(column, threshold);

    let marksCm: number[] = [];
    if (segments.length > 0) {
      const chosen = segments[i % segments.length];
      marksCm = [
        pixelYToCm(chosen.topY, grid.height, config.verticalSpacingCm, config.pageHeightCm, config.precisionMm),
        pixelYToCm(chosen.bottomY, grid.height, config.verticalSpacingCm, config.pageHeightCm, config.precisionMm),
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
  firstPage: number,
  threshold: number,
  cropStartX: number,
  cropWidth: number
): PageMeasurement[] {
  const pages: PageMeasurement[] = [];
  const order = orderColumnsByDirection(leafCount, config.direction);

  for (let i = 0; i < leafCount; i++) {
    const col = order[i];
    const { startX, endX } = sampleColumnBounds(cropWidth, leafCount, col, cropStartX);
    const column = collapseColumn(grid, startX, endX);
    const marksCm = findToggles(column, threshold, minTabPixels).map((y) =>
      pixelYToCm(y, grid.height, config.verticalSpacingCm, config.pageHeightCm, config.precisionMm)
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
