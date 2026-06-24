"use client";

import { useEffect, useRef } from "react";
import type { ReadingDirection } from "@/lib/types";
import { pageToSliceIndex, sliceBounds } from "@/lib/algorithm";

interface ImagePreviewProps {
  thumbnail: string | null;
  totalLeaves: number;
  currentPage: number;
  foldedPages: number[];
  direction: ReadingDirection;
}

/**
 * Renders the target image and overlays the vertical slices:
 *   - folded pages → filled coral
 *   - current page → outlined gold
 * Slice positions honor reading direction so the fill grows from the
 * correct edge (left for LTR, right for RTL).
 */
export default function ImagePreview({
  thumbnail,
  totalLeaves,
  currentPage,
  foldedPages,
  direction,
}: ImagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (imgW: number, imgH: number, img?: HTMLImageElement) => {
      canvas.width = imgW;
      canvas.height = imgH;
      ctx.clearRect(0, 0, imgW, imgH);

      if (img) {
        ctx.globalAlpha = 1;
        ctx.drawImage(img, 0, 0, imgW, imgH);
      } else {
        ctx.fillStyle = "#efe7d6";
        ctx.fillRect(0, 0, imgW, imgH);
      }

      const foldedSet = new Set(foldedPages);

      for (let page = 1; page <= totalLeaves; page++) {
        const sliceIndex = pageToSliceIndex(page, totalLeaves, direction);
        const { startX, endX } = sliceBounds(imgW, totalLeaves, sliceIndex);
        const w = endX - startX + 1;

        if (foldedSet.has(page)) {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = "#e2614a";
          ctx.fillRect(startX, 0, w, imgH);
        }
        if (page === currentPage) {
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#c79a3a";
          ctx.lineWidth = Math.max(2, imgW * 0.006);
          ctx.strokeRect(
            startX + ctx.lineWidth / 2,
            ctx.lineWidth / 2,
            w - ctx.lineWidth,
            imgH - ctx.lineWidth
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    if (thumbnail) {
      const img = new Image();
      img.onload = () => draw(img.width, img.height, img);
      img.src = thumbnail;
    } else {
      draw(400, 280);
    }
  }, [thumbnail, totalLeaves, currentPage, foldedPages, direction]);

  return (
    <div
      className="rounded-[var(--radius)] overflow-hidden border"
      style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-auto block"
        aria-label="Folding progress preview"
      />
    </div>
  );
}
