"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { extractPixelGrid, makeThumbnail } from "@/lib/imageProcessor";
import { generateFoldingPattern } from "@/lib/algorithm";
import type { FoldingMode, ReadingDirection } from "@/lib/types";
import Field from "./ui/Field";

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)] tabular";
const inputStyle = { borderColor: "var(--line)" } as const;

/** Mode 0 — upload an image + set physical book parameters, then generate. */
export default function ConfigPanel() {
  const { config, setConfig, loadPattern, pattern, setView } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = (f: File | null) => {
    setError(null);
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const onGenerate = async () => {
    setError(null);
    if (!file) {
      setError("Upload an image first — a black silhouette on white works best.");
      return;
    }
    if (config.totalPages < 2 || config.totalPages % 2 !== 0) {
      setError("Total Book Pages must be an even number of at least 2.");
      return;
    }
    if (config.pageHeightCm <= 0) {
      setError("Page Height must be greater than 0.");
      return;
    }
    setBusy(true);
    try {
      const [grid, thumb] = await Promise.all([
        extractPixelGrid(file),
        makeThumbnail(file),
      ]);
      const result = generateFoldingPattern(grid, config);
      loadPattern(result, thumb);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <header className="flex items-center gap-3 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/mekapele-logo.png" alt="Lilou Books" className="h-9 w-auto" />
        <div>
          <h1 className="font-display text-2xl">Book Folding Studio</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Turn an image into a fold-by-fold pattern.
          </p>
        </div>
      </header>

      {/* Upload */}
      <div
        className="rounded-[var(--radius)] border-2 border-dashed p-6 text-center mb-6"
        style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Selected"
            className="max-h-56 mx-auto rounded-lg mb-3 object-contain"
          />
        ) : (
          <p className="text-[var(--ink-soft)] mb-3">
            Drop a binary or grayscale JPG / PNG here.
          </p>
        )}
        <label className="inline-block cursor-pointer px-4 py-2 rounded-lg font-semibold text-white" style={{ background: "var(--coral)" }}>
          {file ? "Choose a different image" : "Choose image"}
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {/* Parameters */}
      <div className="grid sm:grid-cols-2 gap-5 mb-6">
        <Field label="Total Book Pages" hint="Even number. Leaves = pages ÷ 2.">
          <input
            type="number"
            min={2}
            step={2}
            className={inputClass}
            style={inputStyle}
            value={config.totalPages}
            onChange={(e) =>
              setConfig({ totalPages: parseInt(e.target.value || "0", 10) })
            }
          />
        </Field>

        <Field label="Page Height (cm)" hint="Physical height of one page.">
          <input
            type="number"
            min={1}
            step={0.1}
            className={inputClass}
            style={inputStyle}
            value={config.pageHeightCm}
            onChange={(e) =>
              setConfig({ pageHeightCm: parseFloat(e.target.value || "0") })
            }
          />
        </Field>

        <Field label="Folding Mode">
          <select
            className={inputClass}
            style={inputStyle}
            value={config.mode}
            onChange={(e) => setConfig({ mode: e.target.value as FoldingMode })}
          >
            <option value="MMF">MMF — Measure, Mark, Fold</option>
            <option value="CUT_AND_FOLD">Cut &amp; Fold</option>
          </select>
        </Field>

        <Field
          label="Min Tab Size (mm)"
          hint="Cut & Fold only — ignores cuts thinner than this."
        >
          <input
            type="number"
            min={0.1}
            step={0.1}
            disabled={config.mode !== "CUT_AND_FOLD"}
            className={`${inputClass} disabled:opacity-40`}
            style={inputStyle}
            value={config.minTabSizeMm}
            onChange={(e) =>
              setConfig({ minTabSizeMm: parseFloat(e.target.value || "0") })
            }
          />
        </Field>

        <Field
          label="Book Language / Direction"
          hint="LTR for English · RTL for Hebrew / Arabic."
        >
          <select
            className={inputClass}
            style={inputStyle}
            value={config.direction}
            onChange={(e) =>
              setConfig({ direction: e.target.value as ReadingDirection })
            }
          >
            <option value="LTR">LTR — page 1 on the left</option>
            <option value="RTL">RTL — page 1 on the right</option>
          </select>
        </Field>
      </div>

      {error && (
        <p
          className="mb-4 text-sm rounded-lg px-3 py-2"
          style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
        >
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onGenerate}
          disabled={busy}
          className="flex-1 py-3.5 rounded-[var(--radius)] font-semibold text-white text-lg disabled:opacity-60"
          style={{ background: "var(--ink)" }}
        >
          {busy ? "Processing…" : "Generate pattern"}
        </button>
        {pattern && (
          <button
            onClick={() => setView("tracker")}
            className="px-5 rounded-[var(--radius)] font-semibold border"
            style={{ borderColor: "var(--line)" }}
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}
