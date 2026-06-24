// =============================================================================
// CORE ALGORITHM MODULE
// -----------------------------------------------------------------------------
// Converts a binary/grayscale image into per-page folding measurements.
//
// Pipeline:
//   1. Divide image width into (totalPages / 2) vertical slices (one per leaf).
//   2. Map slice order to page order based on reading direction (LTR / RTL).
//   3. Scan each slice's representative column top→bottom:
//        - MMF:          first + last black pixel.
//        - CUT_AND_FOLD: every black/white toggle, gap-filtered by Min Tab.
//   4. Convert each recorded Pixel_Y → centimeters and round to 1 decimal.
//
// Pure & deterministic: no DOM, no canvas — fully unit-testable.
// =============================================================================

import type {
  BookConfig,
  FoldingPattern,
  PageMeasurement,
  PixelGrid,
} from "./types";

/** Luminance at/under this value counts as "black". */
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

/**
 * Compute the inclusive pixel-X range [startX, endX] of slice `sliceIndex`
 * (0-based) when the width is divided into `sliceCount` equal columns.
 * The final slice absorbs any rounding remainder so no pixels are lost.
 */
export function sliceBounds(
  width: number,
  sliceCount: number,
  sliceIndex: number
): { startX: number; endX: number } {
  const sliceWidth = width / sliceCount;
  const startX = Math.floor(sliceIndex * sliceWidth);
  const endX =
    sliceIndex === sliceCount - 1
      ? width - 1
      : Math.floor((sliceIndex + 1) * sliceWidth) - 1;
  return { startX, endX: Math.max(startX, endX) };
}

/**
 * Map a 1-based page number to the slice index that holds its content.
 *
 *   LTR: page 1 → left-most slice (index 0), increasing rightward.
 *   RTL: page 1 → right-most slice (index sliceCount-1), decreasing leftward.
 */
export function pageToSliceIndex(
  page: number,
  sliceCount: number,
  direction: BookConfig["direction"]
): number {
  const zeroBased = page - 1;
  return direction === "LTR" ? zeroBased : sliceCount - 1 - zeroBased;
}

/**
 * Collapse a slice (a band of columns) into a single representative column of
 * luminance by taking the DARKEST pixel across the band at each Y. This keeps
 * thin features visible even if the exact center column happens to be white.
 */
function collapseSliceColumn(
  grid: PixelGrid,
  startX: number,
  endX: number
): Uint8ClampedArray {
  const { width, height, luminance } = grid;
  const column = new Uint8ClampedArray(height);
  for (let y = 0; y < height; y++) {
    let darkest = 255;
    const rowOffset = y * width;
    for (let x = startX; x <= endX; x++) {
      const lum = luminance[rowOffset + x];
      if (lum < darkest) darkest = lum;
    }
    column[y] = darkest;
  }
  return column;
}

/** MMF: first & last black Y in the column → two cm marks. */
function scanMMF(column: Uint8ClampedArray): number[] {
  let first = -1;
  let last = -1;
  for (let y = 0; y < column.length; y++) {
    if (isBlack(column[y])) {
      if (first === -1) first = y;
      last = y;
    }
  }
  return first === -1 ? [] : [first, last];
}

/**
 * CUT_AND_FOLD: every Y where the column toggles white↔black, recorded as
 * [enterBlack, exitBlack] pairs. Black runs ("tabs") shorter than the minimum
 * tab height (in pixels) are discarded as noise.
 */
function scanCutAndFold(
  column: Uint8ClampedArray,
  minTabPixels: number
): number[] {
  const marks: number[] = [];
  let runStart = -1; // start Y of the current black run

  for (let y = 0; y < column.length; y++) {
    const black = isBlack(column[y]);
    if (black && runStart === -1) {
      runStart = y; // white → black
    } else if (!black && runStart !== -1) {
      // black → white: close the run
      if (y - runStart >= minTabPixels) marks.push(runStart, y - 1);
      runStart = -1;
    }
  }
  // Run that reaches the bottom edge.
  if (runStart !== -1 && column.length - runStart >= minTabPixels) {
    marks.push(runStart, column.length - 1);
  }
  return marks;
}

/**
 * Generate the full folding pattern.
 *
 * @param grid   Extracted luminance grid of the uploaded image.
 * @param config Physical book + folding parameters.
 */
export function generateFoldingPattern(
  grid: PixelGrid,
  config: BookConfig
): FoldingPattern {
  const sliceCount = Math.floor(config.totalPages / 2);
  if (sliceCount < 1) {
    throw new Error("Total Book Pages must be at least 2.");
  }

  // Min Tab Size (mm) → pixels, via the page-height physical scale.
  // pixels-per-cm = imageHeight / pageHeightCm; mm → cm is /10.
  const pixelsPerCm = grid.height / config.pageHeightCm;
  const minTabPixels = Math.max(
    1,
    Math.round((config.minTabSizeMm / 10) * pixelsPerCm)
  );

  const pages: PageMeasurement[] = [];

  for (let page = 1; page <= sliceCount; page++) {
    const sliceIndex = pageToSliceIndex(page, sliceCount, config.direction);
    const { startX, endX } = sliceBounds(grid.width, sliceCount, sliceIndex);
    const column = collapseSliceColumn(grid, startX, endX);

    const pixelMarks =
      config.mode === "MMF"
        ? scanMMF(column)
        : scanCutAndFold(column, minTabPixels);

    const marksCm = pixelMarks.map((y) =>
      pixelYToCm(y, grid.height, config.pageHeightCm)
    );

    pages.push({
      page,
      marksCm,
      isBlank: marksCm.length === 0,
    });
  }

  return {
    config,
    pages,
    imageWidth: grid.width,
    imageHeight: grid.height,
    generatedAt: Date.now(),
  };
}
