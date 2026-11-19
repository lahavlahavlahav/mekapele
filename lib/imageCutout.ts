// =============================================================================
// IMAGE CUTOUT - the uploaded image with its light background made
// transparent and trimmed to the design, for the header of exported /
// printed patterns (so a printout can be matched to its picture).
// Browser-only (canvas).
// =============================================================================

import { pickThreshold } from "@/lib/algorithm";

export interface Cutout {
  dataUrl: string;
  /** Pixel size of the trimmed cutout (for aspect ratio). */
  w: number;
  h: number;
}

export async function makeCutout(src: string | null | undefined, autoThreshold = true): Promise<Cutout | null> {
  if (!src || typeof document === "undefined") return null;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });
    const scale = Math.min(1, 600 / Math.max(img.width, img.height));
    const W = Math.max(1, Math.round(img.width * scale));
    const H = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff"; // transparent source areas count as background
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H);
    const px = data.data;

    const luminance = new Uint8ClampedArray(W * H);
    for (let i = 0; i < W * H; i++) {
      luminance[i] = Math.round(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]);
    }
    const threshold = pickThreshold({ width: W, height: H, luminance }, autoThreshold);

    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (luminance[i] >= threshold) {
          px[i * 4 + 3] = 0; // background → transparent
        } else {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    ctx.putImageData(data, 0, 0);

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = cw;
    out.height = ch;
    out.getContext("2d")?.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
    return { dataUrl: out.toDataURL("image/png"), w: cw, h: ch };
  } catch {
    return null;
  }
}
