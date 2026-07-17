"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  cmToPixelY,
  orderColumnsByDirection,
  pixelYToCm,
  sampleColumnBounds,
} from "@/lib/algorithm";
import PageJump from "./PageJump";

const ZOOM_MIN = 1;
const ZOOM_MAX = 6;
const ZOOM_STEP = 0.5;

interface PendingStart {
  leaf: number;
  cm: number;
}

/**
 * Manual correction screen (WonderFold-style): zoom into the source image and
 * click to add/remove fold-mark bands on top of the auto-generated pattern.
 * Two clicks on the same leaf define a band (first = start, second = end);
 * clicking near an existing band's edge removes that whole band instead.
 */
export default function GridEditor() {
  const { pattern, thumbnail, config, setLeafMarks, setView } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(2);
  const [pendingStart, setPendingStart] = useState<PendingStart | null>(null);
  const [hoverLeaf, setHoverLeaf] = useState<number | null>(null);
  const [jumpLeaf, setJumpLeaf] = useState(1);

  useEffect(() => {
    if (!thumbnail) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ width: img.width, height: img.height });
    };
    img.src = thumbnail;
  }, [thumbnail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingStart(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const totalLeaves = pattern?.pages.length ?? 0;

  // The algorithm's working grid (pattern.imageWidth/imageHeight) and the
  // thumbnail are independently downscaled from the same source image, so a
  // single uniform ratio rescales the algorithm's crop bounds (grid-pixel
  // space) into the thumbnail's own pixel space.
  const cropBounds =
    pattern && imgSize && pattern.imageWidth > 0
      ? (() => {
          const scale = imgSize.width / pattern.imageWidth;
          const cropStartX = pattern.cropStartX ?? 0;
          const cropWidth = pattern.cropWidth ?? pattern.imageWidth;
          return { cropStartXThumb: cropStartX * scale, cropWidthThumb: cropWidth * scale };
        })()
      : null;

  const resolveLeaf = useCallback(
    (px: number): number | null => {
      if (!cropBounds || totalLeaves === 0) return null;
      const colWidth = cropBounds.cropWidthThumb / totalLeaves;
      if (colWidth <= 0) return null;
      const col = Math.min(
        totalLeaves - 1,
        Math.max(0, Math.floor((px - cropBounds.cropStartXThumb) / colWidth))
      );
      const leafIndex = config.direction === "LTR" ? col : totalLeaves - 1 - col;
      return leafIndex + 1;
    },
    [cropBounds, totalLeaves, config.direction]
  );

  // Draw the thumbnail + column dividers + existing bands + pending line.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgSize || !pattern || !cropBounds || totalLeaves === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = imgSize.width * zoom;
    const h = imgSize.height * zoom;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const { cropStartXThumb, cropWidthThumb } = cropBounds;
    const order = orderColumnsByDirection(totalLeaves, config.direction);

    for (let i = 0; i < totalLeaves; i++) {
      const leaf = i + 1;
      const col = order[i];
      const { startX, endX } = sampleColumnBounds(cropWidthThumb, totalLeaves, col, cropStartXThumb);
      const x0 = startX * zoom;
      const colW = (endX - startX + 1) * zoom;

      if (leaf === hoverLeaf) {
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#c79a3a";
        ctx.fillRect(x0, 0, colW, h);
      }

      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#8a8577";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, h);
      ctx.stroke();

      const marksCm = pattern.pages[i]?.marksCm ?? [];
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#e2614a";
      for (let m = 0; m + 1 < marksCm.length; m += 2) {
        const yTop = cmToPixelY(marksCm[m], imgSize.height, config.verticalSpacingCm, config.pageHeightCm) * zoom;
        const yBottom = cmToPixelY(marksCm[m + 1], imgSize.height, config.verticalSpacingCm, config.pageHeightCm) * zoom;
        ctx.fillRect(x0, Math.min(yTop, yBottom), colW, Math.abs(yBottom - yTop));
      }

      if (pendingStart && pendingStart.leaf === leaf) {
        const y = cmToPixelY(pendingStart.cm, imgSize.height, config.verticalSpacingCm, config.pageHeightCm) * zoom;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#c79a3a";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + colW, y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.globalAlpha = 1;
  }, [imgSize, zoom, pattern, cropBounds, totalLeaves, config.direction, config.verticalSpacingCm, config.pageHeightCm, hoverLeaf, pendingStart]);

  const canvasPixel = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      px: ((e.clientX - rect.left) * scaleX) / zoom,
      py: ((e.clientY - rect.top) * scaleY) / zoom,
    };
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!pattern || !imgSize) return;
    const { px, py } = canvasPixel(e);
    const leaf = resolveLeaf(px);
    if (leaf === null) return;
    const cm = pixelYToCm(py, imgSize.height, config.verticalSpacingCm, config.pageHeightCm, config.precisionMm);

    const existing = pattern.pages.find((p) => p.leaf === leaf)?.marksCm ?? [];
    const toleranceCm = Math.max(0.3, 4 / zoom);
    const hitIndex = findHitPairIndex(existing, cm, toleranceCm);
    if (hitIndex !== null) {
      const next = existing.filter((_, idx) => idx !== hitIndex && idx !== hitIndex + 1);
      setLeafMarks(leaf, next);
      setPendingStart(null);
      return;
    }

    if (!pendingStart || pendingStart.leaf !== leaf) {
      setPendingStart({ leaf, cm });
      return;
    }

    if (pendingStart.cm === cm) {
      setPendingStart(null); // degenerate zero-height band - treat as cancel
      return;
    }

    const newPair = [Math.min(pendingStart.cm, cm), Math.max(pendingStart.cm, cm)];
    const next = config.mode === "MMF" ? newPair : [...existing, ...newPair];
    setLeafMarks(leaf, next);
    setPendingStart(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { px } = canvasPixel(e);
    setHoverLeaf(resolveLeaf(px));
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPendingStart(null);
  };

  const handleJump = (leaf: number) => {
    const clamped = Math.min(Math.max(1, leaf), totalLeaves || 1);
    setJumpLeaf(clamped);
    if (!cropBounds || !containerRef.current || totalLeaves === 0) return;
    const order = orderColumnsByDirection(totalLeaves, config.direction);
    const col = order[clamped - 1];
    const { startX } = sampleColumnBounds(cropBounds.cropWidthThumb, totalLeaves, col, cropBounds.cropStartXThumb);
    containerRef.current.scrollTo({ left: Math.max(0, startX * zoom - 40), behavior: "smooth" });
  };

  if (!pattern) return null;

  return (
    <div className="min-h-screen pb-8">
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/mekapele-logo.png" alt="Lilou Books" className="h-7 w-auto" />
          <div className="leading-tight">
            <p className="eyebrow">עריכת סימונים ידנית</p>
            <p className="text-sm font-semibold">
              {totalLeaves} עלים · {config.direction} ·{" "}
              {config.mode === "MMF" ? "סימון וקיפול" : "גזירה וקיפול"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setView("tracker")}
          className="text-sm px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--line)" }}
        >
          חזרה למעקב
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-5 space-y-4">
        <div
          className="rounded-[var(--radius)] p-4 border text-sm"
          style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
        >
          <p>
            לחיצה ראשונה על עלה מסמנת נקודת התחלה, לחיצה שנייה על אותו עלה
            מוסיפה סימון קיפול. לחיצה קרובה לגבול סימון קיים מוחקת אותו.
            {config.mode === "MMF" &&
              " במצב סימון וקיפול (MMF) כל עלה מקבל סימון אחד בלבד — סימון חדש יחליף את הקיים."}
          </p>
          {pendingStart && (
            <p className="mt-1 font-semibold" style={{ color: "var(--coral-deep)" }}>
              ממתין ללחיצה שנייה על עלה {pendingStart.leaf} (התחלה: {pendingStart.cm.toFixed(1)} סים) — Esc לביטול.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
              className="w-9 h-9 rounded-lg border font-semibold"
              style={{ borderColor: "var(--line)" }}
            >
              −
            </button>
            <span className="text-sm tabular w-14 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
              className="w-9 h-9 rounded-lg border font-semibold"
              style={{ borderColor: "var(--line)" }}
            >
              +
            </button>
          </div>
          <PageJump current={jumpLeaf} total={totalLeaves} onJump={handleJump} />
        </div>

        {!thumbnail ? (
          <p className="text-sm text-[var(--ink-soft)]">אין תמונת מקור זמינה לעריכה.</p>
        ) : (
          <div
            ref={containerRef}
            className="overflow-auto rounded-[var(--radius)] border"
            style={{ borderColor: "var(--line)", maxHeight: "70vh", background: "var(--paper-2)" }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverLeaf(null)}
              onContextMenu={handleContextMenu}
              style={{ cursor: "crosshair", display: "block" }}
              aria-label="עורך סימוני קיפול"
            />
          </div>
        )}
      </main>
    </div>
  );
}

/** Index of the first mark in the pair whose top/bottom boundary is within tolerance of `cm`, or null. */
function findHitPairIndex(marksCm: number[], cm: number, toleranceCm: number): number | null {
  for (let i = 0; i + 1 < marksCm.length; i += 2) {
    if (Math.abs(cm - marksCm[i]) <= toleranceCm || Math.abs(cm - marksCm[i + 1]) <= toleranceCm) {
      return i;
    }
  }
  return null;
}
