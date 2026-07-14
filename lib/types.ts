// Shared domain types for the Book Folding Pattern Generator.

export type FoldingMode = "MMF" | "CUT_AND_FOLD";
export type ReadingDirection = "LTR" | "RTL";

export interface BookConfig {
  totalPages: number; // physical sheet count of the book, e.g. 400
  firstPage: number; // first page of the ACTIVE folding range, e.g. 41
  lastPage: number; // last page of the active range, e.g. 360
  pageHeightCm: number; // physical height of a page, e.g. 21.0
  /**
   * How tall the source image is rendered, in cm ("Vertical Spacing" in
   * reference tools like Wunderfold). The image keeps its native pixel
   * aspect ratio at this height (never stretched) and is centered within
   * pageHeightCm - it is NOT stretched to fill the full page height.
   */
  verticalSpacingCm: number;
  mode: FoldingMode;
  minTabSizeMm: number; // only used in CUT_AND_FOLD, default 1.0
  direction: ReadingDirection;
  /** Trim empty white columns off the left/right edges before slicing. */
  cropSides: boolean;
  /** Compute the black/white threshold per image (Otsu) instead of a fixed value. */
  autoThreshold: boolean;
  /** Rounding granularity for output measurements, in mm (e.g. 1, 0.5, 0.1). */
  precisionMm: number;
}

/**
 * A single recorded mark on a page, expressed in physical centimeters from
 * the top of the page.
 *   • Alternating MMF: each leaf carries at most ONE shape → exactly two marks
 *     [top, bottom]. Disconnected shapes in the same slice are alternated onto
 *     consecutive leaves.
 *   • Cut & Fold (MMCF): an even number of values forming [cutStart, cutEnd, …]
 *     pairs, ALL on the same leaf (4, 6, or more marks allowed).
 */
export interface PageMeasurement {
  /** 1-based leaf index within the active range (1 = first folded leaf). */
  leaf: number;
  /** The physical book page number this leaf corresponds to. */
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
