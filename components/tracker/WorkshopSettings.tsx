"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { useAuth } from "@/components/AuthProvider";
import { extractPixelGrid } from "@/lib/imageProcessor";
import { generateFoldingPattern } from "@/lib/algorithm";
import {
  DEFAULT_PAINT_COLOR,
  MODE_LABEL,
  type BookConfig,
  type FoldingMode,
  type FoldingPattern,
  type ReadingDirection,
} from "@/lib/types";
import Field from "@/components/ui/Field";
import Disclosure from "@/components/ui/Disclosure";

const Preview3DModal = dynamic(() => import("@/components/Preview3D/Preview3DModal"), { ssr: false });

const inputClass = "w-full px-3 py-2 rounded-lg border bg-[var(--paper)] tabular text-sm";
const inputStyle = { borderColor: "var(--line)" } as const;

/**
 * Workshop-mode side card: tweak the main settings (page range, height,
 * technique, direction, image height) without leaving the tracker, preview the
 * change in 3D for free, and regenerate the pattern from the same image.
 * Regenerating goes through /api/generate like the settings screen (needs the
 * monthly pass) and restarts the fold progress, since leaves/marks change.
 */
export default function WorkshopSettings() {
  const { pattern, thumbnail, sourceImage, foldedPages, setConfig, loadPattern } = useStore();
  const { getToken } = useAuth();
  const [draft, setDraft] = useState<BookConfig | null>(pattern?.config ?? null);
  const [busy, setBusy] = useState<"3d" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FoldingPattern | null>(null);

  // A freshly loaded/regenerated pattern resets the draft to its settings.
  useEffect(() => {
    if (pattern) setDraft(pattern.config);
  }, [pattern]);

  if (!pattern || !draft) return null;
  const image = sourceImage ?? thumbnail;
  const update = (patch: Partial<BookConfig>) => setDraft({ ...draft, ...patch });
  const changed = JSON.stringify(draft) !== JSON.stringify(pattern.config);

  const validate = (): boolean => {
    if (!image) {
      setError("התמונה המקורית לא נשמרה - חזרו להגדרות והעלו אותה שוב.");
      return false;
    }
    if (!(draft.pageHeightCm > 0) || !(draft.verticalSpacingCm > 0)) {
      setError("גובה העמוד וגובה התמונה חייבים להיות גדולים מ-0.");
      return false;
    }
    if (Math.abs(draft.lastPage - draft.firstPage) < 2) {
      setError("טווח העמודים קטן מדי.");
      return false;
    }
    return true;
  };

  const imageFile = async (): Promise<File> => {
    const blob = await (await fetch(image!)).blob();
    return new File([blob], "workshop-image.jpg", { type: blob.type || "image/jpeg" });
  };

  const onPreview3D = async () => {
    setError(null);
    if (!validate()) return;
    setBusy("3d");
    try {
      const grid = await extractPixelGrid(await imageFile());
      setPreview(generateFoldingPattern(grid, draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "תצוגת התלת-ממד נכשלה. נסו שוב.");
    } finally {
      setBusy(null);
    }
  };

  const onRegenerate = async () => {
    setError(null);
    if (!validate()) return;
    if (
      foldedPages.length > 0 &&
      !confirm("עדכון התבנית יתחיל את ההתקדמות מההתחלה (סימוני 'קיפלתי' יימחקו). להמשיך?")
    ) {
      return;
    }
    setBusy("generate");
    try {
      const token = await getToken();
      const form = new FormData();
      form.set("image", await imageFile());
      form.set("config", JSON.stringify(draft));
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(
          res.status === 402
            ? "כדי לעדכן את התבנית צריך מנוי פעיל."
            : json.error || "עדכון התבנית נכשל. נסו שוב."
        );
        return;
      }
      setConfig(draft);
      loadPattern(json.pattern, thumbnail, sourceImage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "עדכון התבנית נכשל. נסו שוב.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Disclosure title="עריכת הגדרות ותצוגה" level="h2" size="md">
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="עמוד ראשון">
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                style={inputStyle}
                value={draft.firstPage}
                onChange={(e) => update({ firstPage: parseInt(e.target.value || "0", 10) })}
              />
            </Field>
            <Field label="עמוד אחרון">
              <input
                type="number"
                inputMode="numeric"
                className={inputClass}
                style={inputStyle}
                value={draft.lastPage}
                onChange={(e) => update({ lastPage: parseInt(e.target.value || "0", 10) })}
              />
            </Field>
          </div>

          <Field label="גובה העמוד (ס״מ)">
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              className={inputClass}
              style={inputStyle}
              value={draft.pageHeightCm}
              onChange={(e) => update({ pageHeightCm: parseFloat(e.target.value || "0") })}
            />
          </Field>

          <Field label={`גובה התמונה על הדף (${draft.verticalSpacingCm.toFixed(1)} ס״מ)`}>
            <input
              type="range"
              min={1}
              max={30}
              step={0.5}
              value={draft.verticalSpacingCm}
              onChange={(e) => update({ verticalSpacingCm: parseFloat(e.target.value) })}
              className="w-full"
            />
          </Field>

          <Field label="שיטת קיפול">
            <select
              className={inputClass}
              style={inputStyle}
              value={draft.mode}
              onChange={(e) => update({ mode: e.target.value as FoldingMode })}
            >
              {(Object.keys(MODE_LABEL) as FoldingMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>

          {draft.mode === "MMF" && (
            <Field label="קווי MMF">
              <select
                className={inputClass}
                style={inputStyle}
                value={draft.mmfLines ?? 1}
                onChange={(e) => update({ mmfLines: parseInt(e.target.value, 10) })}
              >
                <option value={1}>קו אחד</option>
                <option value={2}>2 קווים</option>
                <option value={3}>3 קווים</option>
              </select>
            </Field>
          )}

          {draft.mode === "PAINT" && (
            <Field label="צבע">
              <input
                type="color"
                value={draft.paintColor || DEFAULT_PAINT_COLOR}
                onChange={(e) => update({ paintColor: e.target.value })}
                className="h-9 w-14 rounded border-0 bg-transparent cursor-pointer"
              />
            </Field>
          )}

          <Field label="שפת הספר / כיוון">
            <select
              className={inputClass}
              style={inputStyle}
              value={draft.direction}
              onChange={(e) => update({ direction: e.target.value as ReadingDirection })}
            >
              <option value="LTR">LTR — עמוד 1 בצד שמאל</option>
              <option value="RTL">RTL — עמוד 1 בצד ימין</option>
            </select>
          </Field>

          {error && <p className="text-sm" style={{ color: "var(--coral-deep)" }}>{error}</p>}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onPreview3D}
              disabled={busy !== null}
              className="py-2.5 rounded-lg border font-semibold text-sm disabled:opacity-50"
              style={{ borderColor: "var(--line)", background: "var(--paper)" }}
            >
              {busy === "3d" ? "מכין…" : "תצוגת 3D"}
            </button>
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy !== null || !changed}
              className="py-2.5 rounded-lg font-semibold text-sm text-white disabled:opacity-40"
              style={{ background: "var(--ink)" }}
            >
              {busy === "generate" ? "מעדכן…" : "עדכון התבנית"}
            </button>
          </div>
          <p className="text-xs text-[var(--ink-soft)]">
            תצוגת 3D מראה את ההגדרות שבחרתם כאן גם לפני העדכון. עדכון התבנית מחשב מחדש את
            המידות ומתחיל את ההתקדמות מההתחלה.
          </p>
        </div>
      </Disclosure>

      {preview && (
        <Preview3DModal pattern={preview} coverImageUrl={thumbnail} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
