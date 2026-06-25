// =============================================================================
// SERVER IMAGE PROCESSOR  (sharp)
// -----------------------------------------------------------------------------
// Decodes validated image bytes into a luminance PixelGrid for the algorithm.
// Runs ONLY on the server, so the real measurement generation cannot be done
// in the browser — this is what makes paid gating enforceable.
// =============================================================================

import "server-only";
import sharp from "sharp";
import type { PixelGrid } from "@/lib/types";

const MAX_EDGE = 1600; // cap longest edge for performance

/**
 * Convert image bytes → grayscale luminance grid.
 * Applies a downscale so huge uploads stay fast, mirroring the client preview.
 */
export async function extractPixelGridServer(
  bytes: Uint8Array
): Promise<PixelGrid> {
  const pipeline = sharp(Buffer.from(bytes), { failOn: "error" })
    .rotate() // respect EXIF orientation
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .grayscale();

  const { data, info } = await pipeline
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const luminance = new Uint8ClampedArray(width * height);

  // Grayscale output is 1 channel; guard in case sharp returns more.
  for (let p = 0, i = 0; p < luminance.length; p++, i += channels) {
    luminance[p] = data[i];
  }

  return { width, height, luminance };
}
