"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { extractPixelGrid, makeThumbnail } from "@/lib/imageProcessor";
import { generateFoldingPattern } from "@/lib/algorithm";
import type { FoldingMode, ReadingDirection, FoldingPattern } from "@/lib/types";
import Field from "./ui/Field";
import { useAuth } from "./AuthProvider";
import { LoginGate, UserBadge } from "./LoginGate";
import { savePattern } from "@/lib/firestore/patterns";

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)] tabular";
const inputStyle = { borderColor: "var(--line)" } as const;

/** Build a deliberately low-res, watermarked-feeling preview for guests. */
function downscalePattern(p: FoldingPattern): FoldingPattern {
  // Keep only every Nth leaf and blur the cm precision so the guest sees the
  // SHAPE of the result but not usable exact measurements.
  const step = Math.max(1, Math.floor(p.pages.length / 12));
  const pages = p.pages
    .filter((_, i) => i % step === 0)
    .map((pg) => ({
      ...pg,
      marksCm: pg.marksCm.map((m) => Math.round(m)), // whole-cm only
    }));
  return { ...p, pages };
}

/** Mode 0 — upload an image + set physical book parameters, then generate. */
export default function ConfigPanel() {
  const { config, setConfig, loadPattern, pattern, setView } = useStore();
  const { user, getToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    if (config.totalPages < 2 || config.totalPages % 2 !== 0) {
      setError("מספר עמודי הספר חייב להיות מספר זוגי, לפחות 2.");
      return false;
    }
    if (config.pageHeightCm <= 0) {
      setError("גובה העמוד חייב להיות גדול מ-0.");
      return false;
    }
    return true;
  }

  // GUEST: local, low-res preview only (no exact measurements).
  const onPreview = async () => {
    setError(null);
    setShowGate(false);
    if (!validate() || !file) return;
    setBusy(true);
    try {
      const [grid, thumb] = await Promise.all([
        extractPixelGrid(file),
        makeThumbnail(file),
      ]);
      const full = generateFoldingPattern(grid, config);
      loadPattern(downscalePattern(full), thumb);
      // Nudge guests toward signing in for the real thing.
      if (!user) setShowGate(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "משהו השתבש.");
    } finally {
      setBusy(false);
    }
  };

  // AUTHED: call the secure server route for exact measurements.
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
      const token = await getToken();
      const thumb = await makeThumbnail(file);
      const form = new FormData();
      form.append("image", file);
      form.append("config", JSON.stringify(config));

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });

      if (res.status === 401) {
        setShowGate(true);
        return;
      }
      if (res.status === 402) {
        setError("נגמרו הקרדיטים. ניתן לשדרג כדי להמשיך לייצר תבניות.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "יצירת התבנית נכשלה. נסו שוב.");
        return;
      }
      const data = await res.json();
      loadPattern(data.pattern as FoldingPattern, thumb);
    } catch {
      setError("שגיאת רשת. בדקו את החיבור ונסו שוב.");
    } finally {
      setBusy(false);
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

      {/* Parameters */}
      <div className="grid sm:grid-cols-2 gap-5 mb-6">
        <Field label="סך עמודי הספר" hint="מספר זוגי. מספר העלים = עמודים ÷ 2.">
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

        <Field label="גובה העמוד (ס״מ)" hint="הגובה הפיזי של עמוד אחד.">
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

        <Field label="שיטת קיפול">
          <select
            className={inputClass}
            style={inputStyle}
            value={config.mode}
            onChange={(e) => setConfig({ mode: e.target.value as FoldingMode })}
          >
            <option value="MMF">סימון וקיפול</option>
            <option value="CUT_AND_FOLD">גזירה וקיפול</option>
          </select>
        </Field>

        <Field
          label="גודל לשונית מינימלי (מ״מ)"
          hint="לגזירה וקיפול בלבד — מתעלם מגזירות דקות מערך זה."
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

      {error && (
        <p
          className="mb-4 text-sm rounded-lg px-3 py-2"
          style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Guest-friendly local preview (low-res, whole-cm). */}
        <button
          onClick={onPreview}
          disabled={busy}
          className="flex-1 min-w-[8rem] py-3.5 rounded-[var(--radius)] font-semibold border text-lg disabled:opacity-60"
          style={{ borderColor: "var(--line)" }}
        >
          {busy ? "מעבד…" : "תצוגה מקדימה"}
        </button>

        {/* Authenticated, server-side exact generation. */}
        <button
          onClick={onGenerate}
          disabled={busy}
          className="flex-1 min-w-[8rem] py-3.5 rounded-[var(--radius)] font-semibold text-white text-lg disabled:opacity-60"
          style={{ background: "var(--ink)" }}
        >
          {busy ? "מעבד…" : "צרו תבנית מדויקת"}
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
    </div>
  );
}
