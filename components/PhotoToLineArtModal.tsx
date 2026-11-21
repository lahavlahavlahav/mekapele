"use client";

// =============================================================================
// PHOTO → LINE ART modal
// -----------------------------------------------------------------------------
// Opens when someone uploads a regular photo. Removes the background in the
// browser, draws it as bold black line art, and lets them tune the amount of
// detail, erase leftovers (a table, a bottle...), paint with a black pen and
// fill outlined areas solid (simpler to fold) before it goes into the
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
import { applyOp, composeDrawing, stamp, type EditOp, type Frame } from "@/lib/lineArt/edits";
import { segmentParts } from "@/lib/lineArt/parts";

type Tool = "none" | "erase" | "pen" | "fill" | "fillLine";

const TOOL_HINT: Record<Tool, string> = {
  none: "",
  erase: "העבירו אצבע על מה שמיותר כדי למחוק.",
  pen: "ציירו בשחור, למשל כדי לסגור רווח בקו המתאר לפני מילוי.",
  fill: "הקישו על אזור (שיער, חולצה, פריט) והוא כולו יתמלא בשחור. אצל אנשים המערכת מזהה לבד את גבולות השיער, הבגדים והפנים.",
  fillLine: "הקישו בתוך אזור קטן שמוקף בקו מתאר (עין, כפתור, רווח בין אצבעות), ורק הוא יתמלא בשחור.",
};

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
  const [tool, setTool] = useState<Tool>("none");
  const [brush, setBrush] = useState(28);
  const [fillTol, setFillTol] = useState(50);
  const [undoCount, setUndoCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  const photoRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<Float32Array | null>(null);
  const preparedRef = useRef<PreparedPhoto | null>(null);
  const inkRef = useRef<Uint8Array | null>(null);
  /** Manual edits in ORIGINAL photo pixels, replayed on top of the ink, so
   *  they survive the slider and re-cropping (background on/off). */
  const opsRef = useRef<EditOp[]>([]);
  /** ink + edits, at working resolution (1 = black). */
  const composedRef = useRef<Uint8Array | null>(null);
  /** Subject mask (working res) that a fill may not leave; null = whole image. */
  const fillMaskRef = useRef<Uint8Array | null>(null);
  /** Body-part map for the current crop (smart fill); null = colour fill only. */
  const partsRef = useRef<{ for: PreparedPhoto; parts: Uint8Array | null } | null>(null);
  const partsJob = useRef<Promise<void> | null>(null);
  const [findingParts, setFindingParts] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const frame = (): Frame | null => {
    const p = preparedRef.current;
    if (!p) return null;
    return { ...p, parts: partsRef.current?.for === p ? partsRef.current.parts : null };
  };

  /** Run part segmentation for the current crop (once), if not done yet. */
  const ensureParts = useCallback(async () => {
    const p = preparedRef.current;
    if (!p) return;
    if (partsRef.current?.for === p) return;
    if (!partsJob.current) {
      setFindingParts(true);
      partsJob.current = segmentParts(p.crop)
        .then((parts) => {
          partsRef.current = { for: p, parts };
        })
        .catch((e) => {
          // No smart fill (offline / unsupported): colour fill still works.
          console.warn("part segmentation failed", e);
          partsRef.current = { for: p, parts: null };
        })
        .finally(() => {
          partsJob.current = null;
          setFindingParts(false);
        });
    }
    await partsJob.current;
  }, []);
  const drawingRef = useRef(false);

  const redraw = useCallback(() => {
    const p = preparedRef.current;
    const img = composedRef.current;
    if (!p || !img || !canvasRef.current) return;
    inkToCanvas(img, null, p.w, p.h, canvasRef.current);
  }, []);

  /** Rebuild ink + all edits (after the slider, a re-crop or an undo). */
  const recompose = useCallback(() => {
    const p = preparedRef.current;
    const ink = inkRef.current;
    if (!p || !ink) return;
    const parts = partsRef.current?.for === p ? partsRef.current.parts : null;
    composedRef.current = composeDrawing(ink, { ...p, parts }, opsRef.current, fillMaskRef.current);
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
      fillMaskRef.current = keepBg ? null : Uint8Array.from(prepared.mask, (v) => (v > 0.5 ? 1 : 0));
      const gray = prepared.gray.slice();
      const mask = prepared.mask.slice();
      const ink = await runWorker(
        { type: "compute", gray, mask, w: prepared.w, h: prepared.h, detail: det },
        [gray.buffer, mask.buffer],
      );
      if (!ink) return;
      inkRef.current = ink;
      // Fills replay on the new crop with its own part map.
      if (opsRef.current.some((o) => o.kind === "fill")) await ensureParts();
      recompose();
      setStage("ready");
      requestAnimationFrame(redraw);
    },
    [redraw, recompose, runWorker, ensureParts],
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
          recompose();
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

  // --- edit tools -------------------------------------------------------------
  /** Screen point → working px + the current brush radius in working px. */
  const toWork = (clientX: number, clientY: number) => {
    const c = canvasRef.current!;
    const p = preparedRef.current!;
    const rect = c.getBoundingClientRect();
    const sx = p.w / rect.width;
    // Brush size is in screen pixels, so it feels the same on phone and desktop.
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * (p.h / rect.height), r: (brush / 2) * sx };
  };

  const brushAt = (clientX: number, clientY: number) => {
    const p = preparedRef.current;
    const img = composedRef.current;
    const op = opsRef.current[opsRef.current.length - 1];
    if (!p || !img || !op || (op.kind !== "erase" && op.kind !== "pen")) return;
    const { x: cx, y: cy, r } = toWork(clientX, clientY);
    const last = op.points[op.points.length - 1];
    // Fill the gap since the previous point so fast swipes stay continuous.
    const lx = last ? (last.x - p.x0) * p.scale : cx;
    const ly = last ? (last.y - p.y0) * p.scale : cy;
    const steps = Math.max(1, Math.ceil(Math.hypot(cx - lx, cy - ly) / Math.max(1, r / 2)));
    const v = op.kind === "pen" ? 1 : 0;
    for (let k = 1; k <= steps; k++) {
      const x = lx + ((cx - lx) * k) / steps;
      const y = ly + ((cy - ly) * k) / steps;
      stamp(img, p.w, p.h, x, y, r, v);
      op.points.push({ x: p.x0 + x / p.scale, y: p.y0 + y / p.scale, r: r / p.scale });
    }
    redraw();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = preparedRef.current;
    const img = composedRef.current;
    if (tool === "none" || !p || !img) return;
    if (tool === "fillLine") {
      const { x, y } = toWork(e.clientX, e.clientY);
      const op: EditOp = { kind: "fillLine", x: p.x0 + x / p.scale, y: p.y0 + y / p.scale };
      if (applyOp(img, p, op, fillMaskRef.current)) {
        opsRef.current.push(op);
        setUndoCount(opsRef.current.length);
        setNotice(null);
        redraw();
      } else {
        setNotice("האזור הזה לא סגור בקו, לכן לא מילאנו אותו. אפשר לסגור את הקו עם העט השחור ולהקיש שוב.");
      }
      return;
    }
    if (tool === "fill") {
      const { x, y } = toWork(e.clientX, e.clientY);
      const op: EditOp = { kind: "fill", x: p.x0 + x / p.scale, y: p.y0 + y / p.scale, tol: fillTol };
      ensureParts().then(() => {
        const f = frame();
        const cur = composedRef.current;
        if (!f || !cur || preparedRef.current !== p) return;
        opsRef.current.push(op);
        applyOp(cur, f, op, fillMaskRef.current);
        setUndoCount(opsRef.current.length);
        redraw();
      });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    opsRef.current.push({ kind: tool, points: [] });
    setUndoCount(opsRef.current.length);
    drawingRef.current = true;
    brushAt(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingRef.current) brushAt(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    drawingRef.current = false;
  };
  const onUndo = () => {
    if (!opsRef.current.length) return;
    opsRef.current.pop();
    recompose();
    setUndoCount(opsRef.current.length);
    redraw();
  };

  const onContinue = async () => {
    const p = preparedRef.current;
    const img = composedRef.current;
    if (!p || !img) return;
    setSaving(true);
    try {
      const out = inkToCanvas(img, null, p.w, p.h);
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
          העליתם תמונה רגילה. הרקע הוסר והתמונה צוירה בקווים שחורים, כדי שתתאים לקיפול. אפשר לכוון את כמות הפרטים,
          למחוק חלקים מיותרים ולמלא אזורים בשחור כדי שהתבנית תהיה פשוטה יותר.
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
              touchAction: tool !== "none" ? "none" : "auto",
              cursor: tool === "none" ? "default" : tool === "fill" || tool === "fillLine" ? "cell" : "crosshair",
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
              {(
                [
                  ["erase", "🩹 מחק"],
                  ["pen", "✏️ עט שחור"],
                  ["fill", "🪣 מילוי בשחור"],
                  ["fillLine", "◼️ מילוי בתוך קו"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => {
                    setTool((cur) => (cur === t ? "none" : t));
                    setNotice(null);
                    // Start loading the part model as soon as the fill is picked.
                    if (t === "fill") ensureParts();
                  }}
                  className="px-3 py-2 rounded-lg border text-sm font-semibold"
                  style={{
                    borderColor: "var(--line)",
                    background: tool === t ? "var(--coral)" : "transparent",
                    color: tool === t ? "#fff" : "inherit",
                  }}
                  aria-pressed={tool === t}
                >
                  {label}
                </button>
              ))}
              <button
                onClick={onUndo}
                disabled={!undoCount}
                className="px-3 py-2 rounded-lg border text-sm disabled:opacity-40"
                style={{ borderColor: "var(--line)" }}
              >
                ↶ ביטול
              </button>
              <button
                onClick={() => setShowOriginal((v) => !v)}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: "var(--line)" }}
              >
                {showOriginal ? "הצגת הציור" : "השוואה למקור"}
              </button>
            </div>

            {notice && (
              <p className="text-sm rounded-lg px-3 py-2 -mt-2" style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}>
                {notice}
              </p>
            )}
            {tool !== "none" && (
              <div className="flex flex-wrap items-center gap-3 -mt-2 text-sm text-[var(--ink-soft)]">
                <span>{tool === "fill" && findingParts ? "מזהים שיער, פנים ובגדים בתמונה…" : TOOL_HINT[tool]}</span>
                {tool === "fill" && (
                  <label className="flex items-center gap-2">
                    כמה להתפשט
                    <input
                      type="range"
                      min={15}
                      max={90}
                      value={fillTol}
                      onChange={(e) => setFillTol(parseInt(e.target.value, 10))}
                      dir="ltr"
                    />
                  </label>
                )}
                {(tool === "erase" || tool === "pen") && (
                  <label className="flex items-center gap-2">
                    גודל
                    <input
                      type="range"
                      min={6}
                      max={70}
                      value={brush}
                      onChange={(e) => setBrush(parseInt(e.target.value, 10))}
                      dir="ltr"
                    />
                  </label>
                )}
              </div>
            )}

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
