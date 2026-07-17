"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  cmToPixelY,
  orderColumnsByDirection,
  pixelYToCm,
  sampleColumnBounds,
} from "@/lib/algorithm";
import { exportPatternPdf } from "@/lib/pdf/exportPdf";
import type { FoldingPattern } from "@/lib/types";

type ViewMode = "single" | "table";

/** Fine reference grid drawn over the single-leaf image, every N cm. */
const GRID_STEP_CM = 1;
/** A single leaf column is narrow in the source image - blow it up to this width for precision editing. */
const CANVAS_DISPLAY_WIDTH = 280;

/**
 * Manual correction screen (WonderFold-style): jump to any page directly,
 * see that page's image as a fine measurement grid, and edit its fold marks
 * as an exact numeric list (add/remove/retype), or reset back to the
 * originally generated values.
 */
export default function GridEditor() {
  const { pattern, thumbnail, sourceImage, config, originalPages, setLeafMarks, resetLeafMarks, setView } =
    useStore();
  // Prefer the high-resolution source image (matches the algorithm's own
  // working resolution) over the small 480px thumbnail - the thumbnail blurs
  // badly once blown up per-leaf for precision editing. Falls back to
  // thumbnail for patterns saved before sourceImage existed.
  const editImage = sourceImage ?? thumbnail;

  const [mode, setMode] = useState<ViewMode>("single");
  const [currentLeaf, setCurrentLeaf] = useState(1);
  const [leafInput, setLeafInput] = useState("1");
  const [imgSize, setImgSize] = useState<{ width: number; height: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const totalLeaves = pattern?.pages.length ?? 0;

  useEffect(() => {
    if (!editImage) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ width: img.width, height: img.height });
    };
    img.src = editImage;
  }, [editImage]);

  useEffect(() => setLeafInput(String(currentLeaf)), [currentLeaf]);

  // Same crop-bounds rescaling as before: the algorithm's working grid and the
  // thumbnail are independently downscaled from the same source, so a single
  // uniform ratio bridges grid-pixel space to thumbnail-pixel space.
  const cropBounds =
    pattern && imgSize && pattern.imageWidth > 0
      ? (() => {
          const scale = imgSize.width / pattern.imageWidth;
          const cropStartX = pattern.cropStartX ?? 0;
          const cropWidth = pattern.cropWidth ?? pattern.imageWidth;
          return { cropStartXThumb: cropStartX * scale, cropWidthThumb: cropWidth * scale };
        })()
      : null;

  const leafColumnBounds = useMemo(() => {
    if (!cropBounds || totalLeaves === 0) return null;
    const order = orderColumnsByDirection(totalLeaves, config.direction);
    const col = order[currentLeaf - 1];
    return sampleColumnBounds(cropBounds.cropWidthThumb, totalLeaves, col, cropBounds.cropStartXThumb);
  }, [cropBounds, totalLeaves, config.direction, currentLeaf]);

  const page = pattern?.pages[currentLeaf - 1] ?? null;
  const marksCm = page?.marksCm ?? [];
  const hasOriginal = !!originalPages?.some((p) => p.leaf === currentLeaf);

  // Draw the single leaf's image slice, scaled up, with a fine cm grid and
  // every current mark highlighted as a line at its height.
  useEffect(() => {
    if (mode !== "single") return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgSize || !leafColumnBounds) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { startX, endX } = leafColumnBounds;
    const colWidthPx = Math.max(1, endX - startX + 1);
    const scale = CANVAS_DISPLAY_WIDTH / colWidthPx;
    const displayHeight = imgSize.height * scale;

    canvas.width = CANVAS_DISPLAY_WIDTH;
    canvas.height = displayHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, startX, 0, colWidthPx, imgSize.height, 0, 0, canvas.width, displayHeight);

    ctx.strokeStyle = "rgba(74,84,104,0.25)";
    ctx.fillStyle = "#4a5468";
    ctx.font = "10px sans-serif";
    ctx.lineWidth = 1;
    for (let cm = 0; cm <= config.pageHeightCm; cm += GRID_STEP_CM) {
      const y = cmToPixelY(cm, imgSize.height, config.verticalSpacingCm, config.pageHeightCm) * scale;
      if (y < 0 || y > displayHeight) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
      ctx.fillText(cm.toFixed(0), 2, Math.max(9, y - 2));
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#e2614a";
    for (const cm of marksCm) {
      const y = cmToPixelY(cm, imgSize.height, config.verticalSpacingCm, config.pageHeightCm) * scale;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }, [mode, imgSize, leafColumnBounds, marksCm, config.pageHeightCm, config.verticalSpacingCm]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imgSize || !page || !leafColumnBounds) return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const displayY = (e.clientY - rect.top) * scaleY;

    const colWidthPx = Math.max(1, leafColumnBounds.endX - leafColumnBounds.startX + 1);
    const scale = CANVAS_DISPLAY_WIDTH / colWidthPx;
    const nativeY = displayY / scale;
    const cm = pixelYToCm(nativeY, imgSize.height, config.verticalSpacingCm, config.pageHeightCm, config.precisionMm);

    const toleranceCm = 0.3;
    const hitIdx = marksCm.findIndex((v) => Math.abs(v - cm) <= toleranceCm);
    if (hitIdx !== -1) {
      setLeafMarks(currentLeaf, marksCm.filter((_, i) => i !== hitIdx));
    } else {
      setLeafMarks(currentLeaf, [...marksCm, cm]);
    }
  };

  const goToLeaf = (n: number) => {
    if (totalLeaves === 0) return;
    setCurrentLeaf(Math.min(Math.max(1, n), totalLeaves));
    setMode("single");
  };

  const commitLeafInput = () => goToLeaf(parseInt(leafInput || "1", 10));

  const handleMarkChange = (idx: number, value: string) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    const next = [...marksCm];
    next[idx] = num;
    setLeafMarks(currentLeaf, next);
  };

  const handleDeleteMark = (idx: number) => {
    setLeafMarks(currentLeaf, marksCm.filter((_, i) => i !== idx));
  };

  const handleAddMark = () => {
    const base = marksCm.length > 0 ? marksCm[marksCm.length - 1] + 1 : config.pageHeightCm / 2;
    setLeafMarks(currentLeaf, [...marksCm, Math.min(config.pageHeightCm, Math.max(0, base))]);
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

      <main className="max-w-3xl mx-auto px-4 pt-5 space-y-4">
        {/* Top nav: jump to any page directly, plus table/PDF toggles. */}
        <PageNav
          current={currentLeaf}
          total={totalLeaves}
          leafInput={leafInput}
          onLeafInputChange={setLeafInput}
          onCommit={commitLeafInput}
          onPrev={() => goToLeaf(currentLeaf - 1)}
          onNext={() => goToLeaf(currentLeaf + 1)}
          extra={
            <>
              <button
                onClick={() => setMode(mode === "table" ? "single" : "table")}
                className="text-sm px-3 py-2 rounded-lg font-semibold"
                style={
                  mode === "table"
                    ? { background: "var(--ink)", color: "#fff" }
                    : { border: "1px solid var(--line)" }
                }
              >
                טבלה
              </button>
              <button
                onClick={() => exportPatternPdf(pattern, "תבנית")}
                className="text-sm px-3 py-2 rounded-lg border"
                style={{ borderColor: "var(--line)" }}
              >
                ייצוא PDF
              </button>
            </>
          }
        />

        {mode === "table" ? (
          <TableView pattern={pattern} activeLeaf={currentLeaf} onSelect={goToLeaf} />
        ) : (
          <div className="grid sm:grid-cols-[220px_1fr] gap-4">
            {/* Left panel: exact numeric fold list for this page. */}
            <div
              className="rounded-[var(--radius)] p-4 border space-y-2"
              style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
            >
              <p className="font-semibold mb-1">עלה {currentLeaf}</p>
              {marksCm.length === 0 && (
                <p className="text-sm text-[var(--ink-soft)]">אין סימונים בעלה זו.</p>
              )}
              {marksCm.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-[var(--ink-soft)] w-16 shrink-0">סימון {i + 1}</span>
                  <input
                    type="number"
                    step={0.1}
                    value={v}
                    onChange={(e) => handleMarkChange(i, e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border text-center tabular"
                    style={{ borderColor: "var(--line)", background: "var(--paper)" }}
                  />
                  <button
                    onClick={() => handleDeleteMark(i)}
                    aria-label="מחיקת סימון"
                    className="w-7 h-7 shrink-0 rounded-full text-sm"
                    style={{ background: "var(--line)", color: "var(--ink-soft)" }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                onClick={handleAddMark}
                className="w-full mt-2 py-2 rounded-lg border text-sm font-semibold"
                style={{ borderColor: "var(--line)" }}
              >
                הוסף סימון
              </button>
              <button
                onClick={() => resetLeafMarks(currentLeaf)}
                disabled={!hasOriginal}
                className="w-full py-2 rounded-lg border text-sm font-semibold disabled:opacity-40"
                style={{ borderColor: "var(--line)" }}
              >
                איפוס עמוד
              </button>
              <button
                onClick={() => setView("tracker")}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--coral)" }}
              >
                סיום
              </button>
            </div>

            {/* Single-page image: fine cm grid, marks highlighted, click to add/remove. */}
            <div
              className="rounded-[var(--radius)] border flex items-start justify-center p-3"
              style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
            >
              {!editImage ? (
                <p className="text-sm text-[var(--ink-soft)] py-8">אין תמונת מקור זמינה לעריכה.</p>
              ) : (
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  style={{ cursor: "crosshair", display: "block" }}
                  aria-label="עורך סימוני קיפול לעלה הנוכחי"
                />
              )}
            </div>
          </div>
        )}

        {/* Bottom nav duplicate, matching the top - jump to any page from here too. */}
        <PageNav
          current={currentLeaf}
          total={totalLeaves}
          leafInput={leafInput}
          onLeafInputChange={setLeafInput}
          onCommit={commitLeafInput}
          onPrev={() => goToLeaf(currentLeaf - 1)}
          onNext={() => goToLeaf(currentLeaf + 1)}
        />
      </main>
    </div>
  );
}

function PageNav({
  current,
  total,
  leafInput,
  onLeafInputChange,
  onCommit,
  onPrev,
  onNext,
  extra,
}: {
  current: number;
  total: number;
  leafInput: string;
  onLeafInputChange: (v: string) => void;
  onCommit: () => void;
  onPrev: () => void;
  onNext: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <NavArrow onClick={onPrev} disabled={current <= 1}>
        ‹
      </NavArrow>
      <input
        type="number"
        min={1}
        max={total}
        value={leafInput}
        onChange={(e) => onLeafInputChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => e.key === "Enter" && onCommit()}
        className="w-20 px-2 py-2 rounded-lg border text-center tabular"
        style={{ borderColor: "var(--line)", background: "var(--paper)" }}
      />
      <span className="text-sm text-[var(--ink-soft)] tabular">/ {total}</span>
      <NavArrow onClick={onNext} disabled={current >= total}>
        ›
      </NavArrow>
      {extra}
    </div>
  );
}

function NavArrow({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-10 h-10 rounded-lg border font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ borderColor: "var(--line)", background: "var(--paper)" }}
    >
      {children}
    </button>
  );
}

function TableView({
  pattern,
  activeLeaf,
  onSelect,
}: {
  pattern: FoldingPattern;
  activeLeaf: number;
  onSelect: (leaf: number) => void;
}) {
  return (
    <div
      className="rounded-[var(--radius)] border overflow-auto"
      style={{ borderColor: "var(--line)", maxHeight: "60vh" }}
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0" style={{ background: "var(--paper-2)" }}>
          <tr>
            <th className="p-2 text-right font-semibold">עלה</th>
            <th className="p-2 text-right font-semibold">עמוד</th>
            <th className="p-2 text-right font-semibold">סימונים (סיו֢ם)</th>
          </tr>
        </thead>
        <tbody>
          {pattern.pages.map((p) => (
            <tr
              key={p.leaf}
              onClick={() => onSelect(p.leaf)}
              className="cursor-pointer border-t"
              style={{
                borderColor: "var(--line)",
                background: p.leaf === activeLeaf ? "var(--paper-2)" : "transparent",
              }}
            >
              <td className="p-2 tabular">{p.leaf}</td>
              <td className="p-2 tabular">{p.page}</td>
              <td className="p-2 tabular">
                {/* dir="ltr" so the browser's bidi algorithm doesn't visually
                    reorder a comma-joined list of LTR numeric runs within an
                    RTL row (e.g. "7.0, 9.5" rendering as "9.5, 7.0"). */}
                <span dir="ltr">
                  {p.isBlank ? "—" : p.marksCm.map((v) => v.toFixed(1)).join(", ")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
