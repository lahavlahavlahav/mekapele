"use client";

import { useEffect, useRef, useState } from "react";
import type { PageMeasurement, ReadingDirection } from "@/lib/types";
import { orderColumnsByDirection, sampleColumnBounds, pixelYToCm } from "@/lib/algorithm";

interface ImagePreviewProps {
  thumbnail: string | null;
  totalLeaves: number;
  currentPage: number;
  foldedPages: number[];
  direction: ReadingDirection;
  pageHeightCm: number;
  verticalSpacingCm: number;
  precisionMm: number;
  /** So a click can be checked against that leaf's actual mark bands - a blank height in the image should never report a mark. */
  pages: PageMeasurement[];
  /** Jumps the tracker to the clicked leaf, so the measurements panel updates immediately. */
  onSelectPage: (page: number) => void;
}

interface ClickInfo {
  xPct: number;
  yPct: number;
  leaf: number;
  cm: number;
  /** Whether the clicked height actually falls inside one of that leaf's marked bands. */
  onMark: boolean;
}

/** True if `cm` falls within any [start, end] pair of the leaf's marksCm (order-independent). */
function heightHasMark(marksCm: number[], cm: number): boolean {
  for (let i = 0; i + 1 < marksCm.length; i += 2) {
    const lo = Math.min(marksCm[i], marksCm[i + 1]);
    const hi = Math.max(marksCm[i], marksCm[i + 1]);
    if (cm >= lo && cm <= hi) return true;
  }
  return false;
}

/**
 * Renders the target image and overlays the vertical slices:
 *   - folded pages → filled coral
 *   - current page → outlined gold
 *   - a thin divider line at every leaf boundary (always visible, not just
 *     current/folded), so the whole layout is readable at a glance
 * Slice positions honor reading direction so the fill grows from the
 * correct edge (left for LTR, right for RTL).
 *
 * Clicking anywhere - marked or blank - jumps the tracker straight to that
 * leaf (its measurements appear in FocusCard), so browsing to a page on
 * purpose is always one click. The floating label still tells the two
 * apart: exact height in cm on a marked spot, "no fold here" on a blank one
 * - the picture and the measurements must always agree on that.
 */
export default function ImagePreview({
  thumbnail,
  totalLeaves,
  currentPage,
  foldedPages,
  direction,
  pageHeightCm,
  verticalSpacingCm,
  precisionMm,
  pages,
  onSelectPage,
}: ImagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);

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
      const colOrder = orderColumnsByDirection(totalLeaves, direction);

      for (let page = 1; page <= totalLeaves; page++) {
        const col = colOrder[page - 1];
        const { startX, endX } = sampleColumnBounds(imgW, totalLeaves, col);
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

        // Leaf-boundary divider — every leaf gets its own line, always on.
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(29,36,51,0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, imgH);
        ctx.stroke();
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

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    if (!canvas.width || !canvas.height || totalLeaves === 0) return;
    const rect = canvas.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const nativeX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const nativeY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const colOrder = orderColumnsByDirection(totalLeaves, direction);
    let page = totalLeaves;
    for (let p = 1; p <= totalLeaves; p++) {
      const col = colOrder[p - 1];
      const { startX, endX } = sampleColumnBounds(canvas.width, totalLeaves, col);
      if (nativeX >= startX && nativeX <= endX) {
        page = p;
        break;
      }
    }

    const cm = pixelYToCm(nativeY, canvas.height, verticalSpacingCm, pageHeightCm, precisionMm);
    const onMark = heightHasMark(pages[page - 1]?.marksCm ?? [], cm);
    setClickInfo({ xPct, yPct, leaf: page, cm, onMark });
    // Always jump - browsing to a blank leaf on purpose (e.g. to confirm
    // there's nothing to fold there) should be just as easy as jumping to a
    // marked one. Only the floating label's reading depends on onMark.
    onSelectPage(page);
  };

  return (
    <div
      className="relative rounded-[var(--radius)] overflow-hidden border"
      style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="w-full h-auto block"
        style={{ cursor: "crosshair" }}
        aria-label="תצוגת התקדמות הקיפול - לחצו במקום כלשהו כדי לעבור לעמוד הזה ולראות את המספרים שלו"
      />
      {clickInfo && (
        <div
          className="absolute px-2 py-1 rounded-lg text-xs font-semibold text-white tabular pointer-events-none"
          style={{
            background: clickInfo.onMark ? "rgba(29,36,51,0.9)" : "rgba(29,36,51,0.55)",
            left: `${clickInfo.xPct}%`,
            top: `${clickInfo.yPct}%`,
            transform: "translate(-50%, -120%)",
            whiteSpace: "nowrap",
          }}
        >
          {clickInfo.onMark
            ? `עלה ${clickInfo.leaf} · ${clickInfo.cm.toFixed(1)} ס״מ`
            : "אין קיפול בגובה הזה"}
        </div>
      )}
    </div>
  );
}
