// Shared domain types for the Book Folding Pattern Generator.

export type FoldingMode = "MMF" | "CUT_AND_FOLD";
export type ReadingDirection = "LTR" | "RTL";

export interface BookConfig {
  totalPages: number; // e.g. 400 (must be even; leaves = totalPages / 2)
  pageHeightCm: number; // physical height of a page, e.g. 21.0
  mode: FoldingMode;
  minTabSizeMm: number; // only used in CUT_AND_FOLD, default 1.0
  direction: ReadingDirection;
}

/**
 * A single recorded mark on a page, expressed in physical centimeters from
 * the top of the page. For MMF there are exactly two (start/end). For
 * Cut & Fold there is an even number of values forming [cutStart, cutEnd, ...]
 * pairs.
 */
export interface PageMeasurement {
  /** 1-based physical sheet/leaf number. */
  page: number;
  /** Measurements in cm, rounded to 1 decimal, ordered top→bottom. */
  marksCm: number[];
  /** True if this leaf has no black pixels (a blank fold). */
  isBlank: boolean;
}

/** Result of running the algorithm over an image + config. */
export interface FoldingPattern {
  config: BookConfig;
  pages: PageMeasurement[];
  imageWidth: number;
  imageHeight: number;
  generatedAt: number;
}

/** Raw grayscale luminance grid extracted from the uploaded image. */
export interface PixelGrid {
  width: number;
  height: number;
  /** luminance[y * width + x] in 0..255 (0 = black, 255 = white). */
  luminance: Uint8ClampedArray;
}
