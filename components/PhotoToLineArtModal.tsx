"use client";

// =============================================================================
// PHOTO → LINE ART modal
// -----------------------------------------------------------------------------
// Opens when someone uploads a regular photo. Removes the background in the
// browser, draws it as bold black line art, and lets them tune the amount of
// detail and erase leftovers (a table, a bottle...) before it goes into the
// pattern generator as a black-on-white image.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  canvasToPngFile,
  decodePhoto,
  inkToCanvas,
  preparePhoto,
  removeBackground,
  warmUpBackgroundRemoval,
  type PreparedPhoto,
} from "@/lib/lineArt/browser";

/** Paint a filled circle (working px) into the erase plane. */
function stamp(erased: Uint8Array, w: number, h: number, cx: number, cy: number, r: number) {
  const r2 = r * r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) erased[y * w + x] = 1;
    }
  }
}

/** Re-draw all strokes (photo px) onto the erase plane of a given crop. */
function rasterizeStrokes(p: PreparedPhoto, strokes: { x: number; y: number; r: number }[][]) {
  const erased = new Uint8Array(p.w * p.h);
  for (const stroke of strokes)
    for (const d of stroke) stamp(erased, p.w, p.h, (d.x - p.x0) * p.scale, (d.y - p.y0) * p.scale, d.r * p.scale);
  return erased;
}

type Stage = "decoding" | "background" | "drawing" | "ready" | "error";

const STAGE_TEXT: Record<Stage, string> = {
  decoding: "קוראים את התמונה…",
  background: "מסירים את הרקע…",
  drawing: "מציירים קווים…",
  ready: "",
  error: "",
};

export default function PhotoToLineArtModal({
  file,
  onUse,
  onUseOriginal,
  onClose,
}: {
  file: File;
  /** The finished black/white drawing as a PNG file. */
  onUse: (f: File) => void;
  /** Keep the uploaded image as-is (no conversion). */
  onUseOriginal: () => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>("decoding");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState(0.5);
  const [keepBackground, setKeepBackground] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [brush, setBrush] = useState(28);
  const [undoCount, setUndoCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const photoRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<Float32Array | null>(null);
  const preparedRef = useRef<PreparedPhoto | null>(null);
  const inkRef = useRef<Uint8Array | null>(null);
  const erasedRef = useRef<Uint8Array | null>(null);
  /** Eraser strokes in ORIGINAL photo pixels, so they survive re-cropping
   *  (switching the background on/off changes the crop). One entry per stroke. */
  const strokesRef = useRef<{ x: number; y: number; r: number }[][]>([]);
  const drawingRef = useRef(false);

  const redraw = useCallback(() => {
    const p = preparedRef.current;
    const ink = inkRef.current;
    if (!p || !ink || !canvasRef.current) return;
    inkToCanvas(ink, erasedRef.current, p.w, p.h, canvasRef.current);
  }, []);

  /** Send work to the worker; resolves with the ink plane of the latest request only. */
  const runWorker = useCallback(
    (msg: Record<string, unknown>, transfer: Transferable[] = []) =>
      new Promise<Uint8Array | null>((resolve, reject) => {
        const w = workerRef.current;
        if (!w) return resolve(null);
        const id = ++reqId.current;
        const onMsg = (e: MessageEvent) => {
          if (e.data.id !== id) return; // another request's answer
          w.removeEventListener("message", onMsg);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(id === reqId.current ? (e.data.ink as Uint8Array) : null);
        };
        w.addEventListener("message", onMsg);
        w.postMessage({ ...msg, id }, transfer);
      }),
    [],
  );

  /** (Re)build the working planes for the current background choice and draw. */
  const compute = useCallback(
    async (keepBg: boolean, det: number) => {
      const photo = photoRef.current;
      if (!photo) return;
      setStage("drawing");
      // Let the stage text paint before the synchronous canvas work.
      await new Promise((r) => setTimeout(r, 30));
      const prepared = preparePhoto(photo, keepBg ? null : maskRef.current);
      preparedRef.current = prepared;
      erasedRef.current = rasterizeStrokes(prepared, strokesRef.current);
      const gray = prepared.gray.slice();
      const mask = prepared.mask.slice();
      const ink = await runWorker(
        { type: "compute", gray, mask, w: prepared.w, h: prepared.h, detail: det },
        [gray.buffer, mask.buffer],
      );
      if (!ink) return;
      inkRef.current = ink;
      setStage("ready");
      requestAnimationFrame(redraw);
    },
    [redraw, runWorker],
  );

  // Pipeline on open.
  useEffect(() => {
    let cancelled = false;
    warmUpBackgroundRemoval();
    workerRef.current = new Worker(new URL("../lib/lineArt/lineArt.worker.ts", import.meta.url));
    (async () => {
      try {
        const photo = await decodePhoto(file);
        if (cancelled) return;
        photoRef.current = photo;
        setStage("background");
        try {
          maskRef.current = await removeBackground(photo);
        } catch (e) {
          // No background removal (offline, old browser): still draw the whole photo.
          console.warn("background removal failed", e);
          maskRef.current = null;
          setKeepBackground(true);
        }
        if (cancelled) return;
        await compute(maskRef.current === null, 0.5);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "משהו השתבש. נסו תמונה אחרת.");
        setStage("error");
      }
    })();
    return () => {
      cancelled = true;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [file, compute]);

  // Slider → re-threshold only (fast), debounced.
  useEffect(() => {
    if (stage !== "ready") return;
    const t = setTimeout(async () => {
      try {
        const ink = await runWorker({ type: "render", detail });
        if (ink) {
          inkRef.current = ink;
          redraw();
        }
      } catch {
        /* ignore */
      }
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  useEffect(() => {
    if (stage === "ready" && !showOriginal) redraw();
  }, [showOriginal, stage, redraw]);

  const onToggleBackground = (keep: boolean) => {
    if (keep === keepBackground) return;
    if (!keep && !maskRef.current) return;
    setKeepBackground(keep);
    compute(keep, detail).catch((e) => {
      setError(e instanceof Error ? e.message : "משהו השתבש.");
      setStage("error");
    });
  };

  // --- eraser -----------------------------------------------------------------
  const eraseAt = (clientX: number, clientY: number) => {
    const c = canvasRef.current;
    const p = preparedRef.current;
    const erased = erasedRef.current;
    if (!c || !p || !erased) return;
    const rect = c.getBoundingClientRect();
    const sx = p.w / rect.width;
    const cx = (clientX - rect.left) * sx;
    const cy = (clientY - rect.top) * (p.h / rect.height);
    // Brush size is in screen pixels, so it feels the same on phone and desktop.
    const r = (brush / 2) * sx;
    const stroke = strokesRef.current[strokesRef.current.length - 1];
    const last = stroke?.[stroke.length - 1];
    // Fill the gap since the previous point so fast swipes stay continuous.
    const lx = last ? (last.x - p.x0) * p.scale : cx;
    const ly = last ? (last.y - p.y0) * p.scale : cy;
    const steps = Math.max(1, Math.ceil(Math.hypot(cx - lx, cy - ly) / Math.max(1, r / 2)));
    for (let k = 1; k <= steps; k++) {
      const x = lx + ((cx - lx) * k) / steps;
      const y = ly + ((cy - ly) * k) / steps;
      stamp(erased, p.w, p.h, x, y, r);
      stroke?.push({ x: p.x0 + x / p.scale, y: p.y0 + y / p.scale, r: r / p.scale });
    }
    redraw();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!erasing || !erasedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    strokesRef.current.push([]);
    setUndoCount(strokesRef.current.length);
    drawingRef.current = true;
    eraseAt(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingRef.current) eraseAt(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    drawingRef.current = false;
  };
  const onUndo = () => {
    const p = preparedRef.current;
    if (!p || !strokesRef.current.length) return;
    strokesRef.current.pop();
    erasedRef.current = rasterizeStrokes(p, strokesRef.current);
    setUndoCount(strokesRef.current.length);
    redraw();
  };

  const onContinue = async () => {
    const p = preparedRef.current;
    const ink = inkRef.current;
    if (!p || !ink) return;
    setSaving(true);
    try {
      const out = inkToCanvas(ink, erasedRef.current, p.w, p.h);
      const base = file.name.replace(/\.[^.]+$/, "") || "photo";
      onUse(await canvasToPngFile(out, `${base}-lines.png`));
    } catch {
      setError("שמירת הציור נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  const busy = stage !== "ready" && stage !== "error";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-3" style={{ background: "rgba(29,36,51,0.5)" }}>
      <div
        className="w-full max-w-2xl max-h-[94vh] overflow-y-auto rounded-[var(--radius)] p-4 sm:p-6"
        style={{ background: "var(--paper)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-xl">הפיכת תמונה לציור קווים</p>
          <button onClick={onClose} aria-label="סגירה" className="text-2xl leading-none px-2">
            ×
          </button>
        </div>

        <p className="text-sm text-[var(--ink-soft)] mb-3">
          העליתם תמונה רגילה. הרקע הוסר והתמונה צוירה בקווים שחורים, כדי שתתאים לקיפול. אפשר לכוון את כמות הפרטים
          ולמחוק חלקים מיותרים.
        </p>

        {/* Preview */}
        <div
          className="relative rounded-lg border overflow-hidden grid place-items-center bg-white"
          style={{ borderColor: "var(--line)", minHeight: 260 }}
        >
          {busy && (
            <div className="flex flex-col items-center gap-3 py-16">
              <span
                className="inline-block h-8 w-8 rounded-full border-4 animate-spin"
                style={{ borderColor: "var(--line)", borderTopColor: "var(--coral)" }}
              />
              <span className="text-sm">{STAGE_TEXT[stage]}</span>
              {stage === "background" && (
                <span className="text-xs text-[var(--ink-soft)]">בפעם הראשונה זה לוקח כמה שניות</span>
              )}
            </div>
          )}
          {stage === "error" && <p className="py-16 px-4 text-center" style={{ color: "var(--coral-deep)" }}>{error}</p>}
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="max-w-full h-auto"
            style={{
              display: stage === "ready" && !showOriginal ? "block" : "none",
              maxHeight: "58vh",
              touchAction: erasing ? "none" : "auto",
              cursor: erasing ? "crosshair" : "default",
            }}
          />
          {stage === "ready" && showOriginal && preparedRef.current && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preparedRef.current.colorUrl} alt="התמונה המקורית" className="max-w-full h-auto" style={{ maxHeight: "58vh" }} />
          )}
        </div>

        {stage === "ready" && (
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="block text-sm font-semibold mb-1">כמות פרטים</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={detail}
                onChange={(e) => setDetail(parseFloat(e.target.value))}
                className="w-full"
                dir="ltr"
              />
              {/* The slider runs left→right; in RTL flow the first span sits on the right. */}
              <span className="flex justify-between text-xs text-[var(--ink-soft)]">
                <span>יותר פרטים</span>
                <span>פחות פרטים</span>
              </span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setErasing((v) => !v)}
                className="px-3 py-2 rounded-lg border text-sm font-semibold"
                style={{
                  borderColor: "var(--line)",
                  background: erasing ? "var(--coral)" : "transparent",
                  color: erasing ? "#fff" : "inherit",
                }}
                aria-pressed={erasing}
              >
                {erasing ? "✓ מחק פעיל, העבירו אצבע על מה שמיותר" : "🩹 מחק"}
              </button>
              {erasing && (
                <label className="flex items-center gap-2 text-sm">
                  גודל
                  <input
                    type="range"
                    min={10}
                    max={70}
                    value={brush}
                    onChange={(e) => setBrush(parseInt(e.target.value, 10))}
                    dir="ltr"
                  />
                </label>
              )}
              <button
                onClick={onUndo}
                disabled={!undoCount}
                className="px-3 py-2 rounded-lg border text-sm disabled:opacity-40"
                style={{ borderColor: "var(--line)" }}
              >
                ↶ ביטול מחיקה
              </button>
              <button
                onClick={() => setShowOriginal((v) => !v)}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "var(--line)" }}
              >
                {showOriginal ? "הצגת הציור" : "השוואה למקור"}
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={keepBackground}
                onChange={(e) => onToggleBackground(e.target.checked)}
                disabled={!maskRef.current}
              />
              להשאיר את הרקע (בלי הסרה)
            </label>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
          <button onClick={onUseOriginal} className="px-4 py-2.5 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }}>
            להשתמש בתמונה כמו שהיא
          </button>
          <button
            onClick={onContinue}
            disabled={stage !== "ready" || saving}
            className="px-5 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--coral)" }}
          >
            {saving ? "שומרים…" : "המשך עם הציור ←"}
          </button>
        </div>
      </div>
    </div>
  );
}
