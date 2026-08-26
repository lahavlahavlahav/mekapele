// =============================================================================
// IMAGE PROCESSOR (client-side, Canvas API)
// -----------------------------------------------------------------------------
// Decodes an uploaded JPG/PNG into a luminance PixelGrid for the algorithm.
// Runs entirely in the browser: no upload, works offline, exact pixel access.
// =============================================================================

import type { PixelGrid } from "./types";

/** Rec. 601 luma — matches how the eye weights R/G/B for grayscale. */
function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Load a File (JPG/PNG) into an HTMLImageElement via an object URL.
 * The URL is revoked once decoding completes.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image. Try a JPG or PNG."));
    };
    img.src = url;
  });
}

/** Read a full-resolution HTMLImageElement into a luminance array (no resizing). */
function readLuminance(img: HTMLImageElement): Uint8ClampedArray {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);

  const luminance = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Treat fully transparent pixels as white (paper).
    const alpha = data[i + 3];
    luminance[p] = alpha === 0 ? 255 : luma(data[i], data[i + 1], data[i + 2]);
  }
  return luminance;
}

/**
 * Extract a luminance grid from an uploaded image file.
 *
 * Large images are downscaled so the longest edge is at most `maxEdge`px,
 * keeping processing fast on phones while preserving fold resolution.
 *
 * The downscale itself takes the DARKEST source pixel in each reduced cell
 * (min-pooling), not a smoothed/averaged resize - a smoothed resize blends a
 * thin black line with its white neighbors, often lightening it enough to
 * fall on the wrong side of the black/white threshold and vanish entirely.
 * Min-pooling can only ever make a cell as light as its darkest source pixel,
 * so a genuinely black hairline in the original survives at any scale factor.
 */
export async function extractPixelGrid(
  file: File,
  maxEdge = 1600
): Promise<PixelGrid> {
  const img = await loadImage(file);
  const srcLuminance = readLuminance(img);

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  if (scale >= 1) {
    return { width: img.width, height: img.height, luminance: srcLuminance };
  }

  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const luminance = new Uint8ClampedArray(width * height).fill(255);

  for (let sy = 0; sy < img.height; sy++) {
    const dy = Math.min(height - 1, Math.floor(sy * scale));
    const srcRow = sy * img.width;
    const dstRow = dy * width;
    for (let sx = 0; sx < img.width; sx++) {
      const dx = Math.min(width - 1, Math.floor(sx * scale));
      const idx = dstRow + dx;
      const v = srcLuminance[srcRow + sx];
      if (v < luminance[idx]) luminance[idx] = v;
    }
  }

  return { width, height, luminance };
}

/**
 * A base64 thumbnail (data URL) for previews & persistence.
 *
 * `format`/`quality` matter a lot at larger `maxEdge` values: PNG re-encodes
 * a photographic source at full fidelity, which for a real photo (not a
 * simple black/white silhouette) can run several MB at 1600px - easily
 * enough to blow past localStorage's ~5-10MB per-origin quota once combined
 * with the rest of the persisted pattern, silently corrupting/truncating
 * what gets saved. JPEG compresses photographic content far more, at a
 * quality loss that doesn't matter for a reference image.
 */
export async function makeThumbnail(
  file: File,
  maxEdge = 480,
  format: "image/png" | "image/jpeg" = "image/png",
  quality = 0.9
): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  if (format === "image/jpeg") {
    // JPEG has no alpha channel - flatten onto white first so transparent
    // areas (common around book-folding silhouettes) don't turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL(format, quality);
}
