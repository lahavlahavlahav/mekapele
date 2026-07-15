"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { extractPixelGrid, makeThumbnail } from "@/lib/imageProcessor";
import { generateFoldingPattern } from "@/lib/algorithm";
import type { FoldingMode, FoldingPattern, ReadingDirection } from "@/lib/types";
import Field from "./ui/Field";
import { useAuth } from "./AuthProvider";
import { LoginGate, UserBadge } from "./LoginGate";
import { savePattern } from "@/lib/firestore/patterns";

// Three.js touches the DOM/WebGL - never render it on the server.
const Preview3DModal = dynamic(() => import("./Preview3D/Preview3DModal"), { ssr: false });

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)] tabular";
const inputStyle = { borderColor: "var(--line)" } as const;

type HeightUnit = "cm" | "mm" | "in";
const UNIT_TO_CM: Record<HeightUnit, number> = { cm: 1, mm: 0.1, in: 2.54 };

const PRECISION_OPTIONS: { label: string; mm: number }[] = [
  { label: "נמוך — 1 מ״מ", mm: 1 },
  { label: "בינוני — 0.5 מ״מ", mm: 0.5 },
  { label: "גבוה — 0.1 מ״מ", mm: 0.1 },
];

/** Mode 0 — upload an image + set physical book parameters, then generate. */
export default function ConfigPanel() {
  const { config, setConfig, loadPattern, pattern, setView } = useStore();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preview3D, setPreview3D] = useState<{ pattern: FoldingPattern; coverImageUrl: string | null } | null>(null);
  const [busy3D, setBusy3D] = useState(false);

  const onSave = async () => {
    if (!user || !pattern) return;
    setSaving(true);
    try {
      const name =
        prompt("שם לתבנית:", "תבנית קיפול") || "תבנית קיפול";
      await savePattern(user.uid, name, pattern);
      setSaved(true);
    } catch {
      setError("השמירה נכשלה. נסו שוב.");
    } finally {
      setSaving(false);
    }
  };

  const onFile = (f: File | null) => {
    setError(null);
    setShowGate(false);
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  function validate(): boolean {
    if (!file) {
      setError("העלו תמונה תחילה — צללית שחורה על רקע לבן עובדת הכי טוב.");
      return false;
    }
    if (config.pageHeightCm <= 0) {
      setError("גובה העמוד חייב להיות גדול מ-0.");
      return false;
    }
    if (config.verticalSpacingCm <= 0) {
      setError("המרווח האנכי חייב להיות גדול מ-0.");
      return false;
    }
    const first = Math.min(config.firstPage, config.lastPage);
    const last = Math.max(config.firstPage, config.lastPage);
    if (last - first < 2) {
      setError("טווח העמודים (מהעמוד הראשון עד האחרון) קטן מדי.");
      return false;
    }
    return true;
  }

  // Generate the real pattern locally in the browser. Requires Google sign-in,
  // but produces the exact measurements immediately — no credits, no server.
  const onGenerate = async () => {
    setError(null);
    setShowGate(false);
    if (!validate() || !file) return;
    if (!user) {
      setShowGate(true);
      return;
    }
    setBusy(true);
    try {
      const [grid, thumb] = await Promise.all([
        extractPixelGrid(file),
        makeThumbnail(file),
      ]);
      const pattern = generateFoldingPattern(grid, config);
      loadPattern(pattern, thumb);
      setView("tracker");
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת התבנית נכשלה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  // Free, no-sign-in-required 3D preview - lets people see the shape before
  // committing to generating/downloading the real thing.
  const onPreview3D = async () => {
    setError(null);
    if (!validate() || !file) return;
    setBusy3D(true);
    try {
      const [grid, thumb] = await Promise.all([
        extractPixelGrid(file),
        makeThumbnail(file),
      ]);
      const pattern = generateFoldingPattern(grid, config);
      setPreview3D({ pattern, coverImageUrl: thumb });
    } catch (e) {
      setError(e instanceof Error ? e.message : "תצוגת התלת-ממד נכשלה. נסו שוב.");
    } finally {
      setBusy3D(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <header className="flex items-center gap-3 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/mekapele-logo.png" alt="Lilou Books" className="h-9 w-auto" />
        <div className="flex-1">
          <h1 className="font-display text-2xl">סטודיו לקיפול ספרים</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            הפכו תמונה לתבנית קיפול, קיפול אחר קיפול.
          </p>
        </div>
        <button
          onClick={() => setView("patterns")}
          className="text-sm px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--line)" }}
        >
          התבניות שלי
        </button>
        <UserBadge />
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
            alt="התמונה שנבחרה"
            className="max-h-56 mx-auto rounded-lg mb-3 object-contain"
          />
        ) : (
          <p className="text-[var(--ink-soft)] mb-3">
            גררו לכאן קובץ JPG / PNG בשחור-לבן או גווני אפור.
          </p>
        )}
        <label className="inline-block cursor-pointer px-4 py-2 rounded-lg font-semibold text-white" style={{ background: "var(--coral)" }}>
          {file ? "בחרו תמונה אחרת" : "בחרו תמונה"}
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {/* Core parameters */}
      <div className="grid sm:grid-cols-2 gap-5 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="עמוד ראשון" hint="תחילת טווח הקיפול, למשל 41.">
            <input
              type="number"
              min={1}
              className={inputClass}
              style={inputStyle}
              value={config.firstPage}
              onChange={(e) =>
                setConfig({ firstPage: parseInt(e.target.value || "0", 10) })
              }
            />
          </Field>
          <Field label="עמוד אחרון" hint="סוף טווח הקיפול, למשל 360.">
            <input
              type="number"
              min={1}
              className={inputClass}
              style={inputStyle}
              value={config.lastPage}
              onChange={(e) =>
                setConfig({ lastPage: parseInt(e.target.value || "0", 10) })
              }
            />
          </Field>
        </div>

        <Field label="גובה העמוד" hint="הגובה הפיזי של עמוד אחד.">
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              step={0.1}
              className={inputClass}
              style={inputStyle}
              value={round(config.pageHeightCm / UNIT_TO_CM[heightUnit])}
              onChange={(e) =>
                setConfig({
                  pageHeightCm:
                    parseFloat(e.target.value || "0") * UNIT_TO_CM[heightUnit],
                })
              }
            />
            <select
              className="px-2 rounded-lg border bg-[var(--paper)]"
              style={inputStyle}
              value={heightUnit}
              onChange={(e) => setHeightUnit(e.target.value as HeightUnit)}
            >
              <option value="cm">ס״מ</option>
              <option value="mm">מ״מ</option>
              <option value="in">אינץ׳</option>
            </select>
          </div>
        </Field>

        <Field
          label={
            <span className="inline-flex items-center gap-1.5">
              שיטת קיפול
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold cursor-help"
                style={{ background: "var(--line)", color: "var(--ink-soft)" }}
                title="סימון וקיפול (MMF): כל עלה מקבל עד 2 סימונים. גזירה וקיפול: כל עלה יכול לקבל כמה זוגות גזירה."
              >
                i
              </span>
            </span>
          }
        >
          <select
            className={inputClass}
            style={inputStyle}
            value={config.mode}
            onChange={(e) => setConfig({ mode: e.target.value as FoldingMode })}
          >
            <option value="MMF">סימון וקיפול (MMF)</option>
            <option value="CUT_AND_FOLD">גזירה וקיפול</option>
          </select>
        </Field>

        <Field
          label="שפת הספר / כיוון"
          hint="LTR לאנגלית · RTL לעברית / ערבית."
        >
          <select
            className={inputClass}
            style={inputStyle}
            value={config.direction}
            onChange={(e) =>
              setConfig({ direction: e.target.value as ReadingDirection })
            }
          >
            <option value="LTR">LTR — עמוד 1 בצד שמאל</option>
            <option value="RTL">RTL — עמוד 1 בצד ימין</option>
          </select>
        </Field>
      </div>

      {/* More options */}
      <button
        type="button"
        onClick={() => setShowMoreOptions((v) => !v)}
        className="text-sm font-semibold mb-3"
        style={{ color: "var(--coral-deep)" }}
      >
        אפשרויות נוספות {showMoreOptions ? "−" : "+"}
      </button>

      {showMoreOptions && (
        <div className="mb-6 space-y-5 rounded-[var(--radius)] p-4 border" style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}>
          <Field
            label={`מרווח אנכי (${config.verticalSpacingCm.toFixed(1)} ס״מ)`}
            hint="כמה גבוה תוצג התמונה על העמוד. התמונה שומרת על יחס הממדים שלה ותמורכז - לא תימתח."
          >
            <input
              type="range"
              min={1}
              max={30}
              step={0.5}
              value={config.verticalSpacingCm}
              onChange={(e) =>
                setConfig({ verticalSpacingCm: parseFloat(e.target.value) })
              }
              className="w-full"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={config.cropSides}
                onChange={(e) => setConfig({ cropSides: e.target.checked })}
              />
              חיתוך שולי התמונה
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={config.autoThreshold}
                onChange={(e) => setConfig({ autoThreshold: e.target.checked })}
              />
              סף שחור/לבן אוטומטי
            </label>
          </div>

          <Field label="דיוק" hint="רזולוציית העיגול של המדידות.">
            <select
              className={inputClass}
              style={inputStyle}
              value={config.precisionMm}
              onChange={(e) =>
                setConfig({ precisionMm: parseFloat(e.target.value) })
              }
            >
              {PRECISION_OPTIONS.map((opt) => (
                <option key={opt.mm} value={opt.mm}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={`גודל לשונית מינימלי (${config.minTabSizeMm.toFixed(1)} מ״מ)`}
            hint="לגזירה וקיפול בלבד — מתעלם מגזירות דקות מערך זה."
          >
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              disabled={config.mode !== "CUT_AND_FOLD"}
              className="w-full disabled:opacity-40"
              value={config.minTabSizeMm}
              onChange={(e) =>
                setConfig({ minTabSizeMm: parseFloat(e.target.value) })
              }
            />
          </Field>
        </div>
      )}

      {/* Advanced (placeholder for future parameters) */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-sm font-semibold mb-3"
        style={{ color: "var(--coral-deep)" }}
      >
        מתקדם {showAdvanced ? "−" : "+"}
      </button>
      {showAdvanced && (
        <div className="mb-6 rounded-[var(--radius)] p-4 border text-sm text-[var(--ink-soft)]" style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}>
          אפשרויות מתקדמות נוספות יתווספו כאן בעתיד.
        </div>
      )}

      {error && (
        <p
          className="mb-4 text-sm rounded-lg px-3 py-2"
          style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Single action: generate the real pattern (requires sign-in). */}
        <button
          onClick={onGenerate}
          disabled={busy}
          className="flex-1 min-w-[10rem] py-3.5 rounded-[var(--radius)] font-semibold text-white text-lg disabled:opacity-60"
          style={{ background: "var(--ink)" }}
        >
          {busy ? "מעבד…" : "צרו תבנית"}
        </button>

        <button
          type="button"
          onClick={onPreview3D}
          disabled={busy3D}
          title="תצוגה מקדימה תלת-ממדית - חינם, לא דורש התחברות"
          className="px-5 rounded-[var(--radius)] font-semibold border disabled:opacity-60"
          style={{ borderColor: "var(--line)" }}
        >
          {busy3D ? "מכין תצוגה…" : "תצוגת 3D"}
        </button>

        {pattern && (
          <button
            onClick={() => setView("tracker")}
            className="px-5 rounded-[var(--radius)] font-semibold border"
            style={{ borderColor: "var(--line)" }}
          >
            המשך
          </button>
        )}
        {pattern && user && (
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 rounded-[var(--radius)] font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--sage)" }}
          >
            {saving ? "שומר…" : saved ? "✓ נשמר" : "שמירה בענן"}
          </button>
        )}
      </div>

      {showGate && (
        <div className="mt-5">
          <LoginGate />
        </div>
      )}

      {preview3D && (
        <Preview3DModal
          pattern={preview3D.pattern}
          coverImageUrl={preview3D.coverImageUrl}
          onClose={() => setPreview3D(null)}
        />
      )}
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
