"use client";

import { useEffect, useRef, useState } from "react";
import type { FoldingPattern, PageMeasurement, ReadingDirection } from "@/lib/types";
import { leafSourceBounds, pixelYToCm } from "@/lib/algorithm";

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
  /** Source of each leaf's exact image column (crop, trimmed ends, direction). */
  pattern: FoldingPattern;
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

/** Inverse of lib/algorithm.ts's pixelYToCm - physical cm down the page -> pixel row. */
function cmToPixelY(cm: number, imgHeightPixels: number, verticalSpacingCm: number, pageHeightCm: number): number {
  if (verticalSpacingCm <= 0) return 0;
  const topMarginCm = (pageHeightCm - verticalSpacingCm) / 2;
  return ((cm - topMarginCm) / verticalSpacingCm) * imgHeightPixels;
}

const DONE_COLOR = "#007bff";
const CURRENT_SEGMENT_COLOR = "#e60000";
const CURRENT_GUIDE_COLOR = "rgba(255,192,203,0.3)";

/**
 * Renders the target image and overlays the vertical slices:
 *   - completed pages (confirmed via "קיפלתי", tracked in foldedPages - not
 *     just "before the current page," since browsing/jumping around is a
 *     supported way to use this tracker and shouldn't misreport progress)
 *     → filled blue across the whole column.
 *   - the current page → NOT tinted as a whole column. Instead a faint
 *     full-height guide line marks the column, with a precise, thick red
 *     segment drawn only where this leaf's actual marks are (mapped from
 *     its real cm values), so the highlight shows exactly what to fold.
 *   - pending pages → left as the plain underlying image, no tint.
 *   - a thin divider line at every leaf boundary (always visible, not just
 *     current/done), so the whole layout is readable at a glance.
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
  pattern,
  onSelectPage,
}: ImagePreviewProps) {
  // Leaf `page` (1-based) -> its pixel band on a canvas `imgW` wide. Shares
  // leafSourceBounds with the algorithm, so each strip shows exactly the
  // pixels that leaf's measurements came from.
  const boundsFor = (page: number, imgW: number) => {
    const scale = pattern.imageWidth > 0 ? imgW / pattern.imageWidth : 1;
    const b = leafSourceBounds(pattern, page - 1);
    return { startX: b.startX * scale, endX: (b.endX + 1) * scale - 1 };
  };
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

      // Grey out image area no leaf covers (cropped side margins / trimmed
      // blank ends), so every visible strip is a real page.
      let minX = imgW;
      let maxX = 0;
      for (let page = 1; page <= totalLeaves; page++) {
        const { startX, endX } = boundsFor(page, imgW);
        minX = Math.min(minX, startX);
        maxX = Math.max(maxX, endX + 1);
      }
      ctx.fillStyle = "rgba(120,120,120,0.35)";
      if (minX > 0) ctx.fillRect(0, 0, minX, imgH);
      if (maxX < imgW) ctx.fillRect(maxX, 0, imgW - maxX, imgH);

      for (let page = 1; page <= totalLeaves; page++) {
        const { startX, endX } = boundsFor(page, imgW);
        const w = endX - startX + 1;
        const centerX = startX + w / 2;

        if (page === currentPage) {
          // Faint guide line down the whole column, then the precise red
          // segment(s) drawn on top only where this leaf actually has marks.
          ctx.globalAlpha = 1;
          ctx.strokeStyle = CURRENT_GUIDE_COLOR;
          ctx.lineWidth = Math.max(2, w * 0.4);
          ctx.beginPath();
          ctx.moveTo(centerX, 0);
          ctx.lineTo(centerX, imgH);
          ctx.stroke();

          const marksCm = pages[page - 1]?.marksCm ?? [];
          ctx.strokeStyle = CURRENT_SEGMENT_COLOR;
          ctx.lineWidth = Math.max(4, w * 0.55);
          for (let i = 0; i + 1 < marksCm.length; i += 2) {
            const yTop = cmToPixelY(Math.min(marksCm[i], marksCm[i + 1]), imgH, verticalSpacingCm, pageHeightCm);
            const yBottom = cmToPixelY(Math.max(marksCm[i], marksCm[i + 1]), imgH, verticalSpacingCm, pageHeightCm);
            ctx.beginPath();
            ctx.moveTo(centerX, yTop);
            ctx.lineTo(centerX, yBottom);
            ctx.stroke();
          }
        } else if (foldedSet.has(page)) {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = DONE_COLOR;
          ctx.fillRect(startX, 0, w, imgH);
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
      // Closing divider after the last strip.
      ctx.beginPath();
      ctx.moveTo(maxX, 0);
      ctx.lineTo(maxX, imgH);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    if (thumbnail) {
      const img = new Image();
      img.onload = () => draw(img.width, img.height, img);
      img.src = thumbnail;
    } else {
      draw(400, 280);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbnail, totalLeaves, currentPage, foldedPages, direction, pattern]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    if (!canvas.width || !canvas.height || totalLeaves === 0) return;
    const rect = canvas.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const nativeX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const nativeY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    let page: number | null = null;
    for (let p = 1; p <= totalLeaves; p++) {
      const { startX, endX } = boundsFor(p, canvas.width);
      if (nativeX >= startX && nativeX < endX + 1) {
        page = p;
        break;
      }
    }
    // Clicked the greyed-out margin outside every page - nothing to select.
    if (page === null) return;

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
      {clickInfo && clickInfo.onMark && (
        <div
          className="absolute px-2 py-1 rounded-lg text-xs font-semibold text-white tabular pointer-events-none"
          style={{
            background: "rgba(29,36,51,0.9)",
            left: `${clickInfo.xPct}%`,
            top: `${clickInfo.yPct}%`,
            transform: "translate(-50%, -120%)",
            whiteSpace: "nowrap",
          }}
        >
          {`עלה ${clickInfo.leaf} · ${clickInfo.cm.toFixed(1)} ס״מ`}
        </div>
      )}
    </div>
  );
}
