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

/**
 * Extract a luminance grid from an uploaded image file.
 *
 * Large images are downscaled so the longest edge is at most `maxEdge`px,
 * keeping processing fast on phones while preserving fold resolution.
 */
export async function extractPixelGrid(
  file: File,
  maxEdge = 1600
): Promise<PixelGrid> {
  const img = await loadImage(file);

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Treat fully transparent pixels as white (paper).
    const alpha = data[i + 3];
    luminance[p] =
      alpha === 0 ? 255 : luma(data[i], data[i + 1], data[i + 2]);
  }

  return { width, height, luminance };
}

/** A small base64 thumbnail (data URL) for the tracker preview & persistence. */
export async function makeThumbnail(file: File, maxEdge = 480): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
