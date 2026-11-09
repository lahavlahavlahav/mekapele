"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/lib/store";
import { extractPixelGrid, makeThumbnail } from "@/lib/imageProcessor";
import { generateFoldingPattern } from "@/lib/algorithm";
import { DEFAULT_PAINT_COLOR, type FoldingMode, type FoldingPattern, type ReadingDirection } from "@/lib/types";
import Field from "./ui/Field";
import InfoTip from "./ui/InfoTip";
import Footer from "./Footer";
import { useAuth } from "./AuthProvider";
import { LoginGate, UserBadge } from "./LoginGate";
import { savePattern } from "@/lib/firestore/patterns";
import SubscriptionBadge from "./subscription/SubscriptionBadge";
import SubscribeModal from "./subscription/SubscribeModal";
import { useSubscription } from "@/lib/hooks/useSubscription";

// Three.js touches the DOM/WebGL - never render it on the server.
const Preview3DModal = dynamic(() => import("./Preview3D/Preview3DModal"), { ssr: false });

const inputClass =
  "w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)] tabular";
const inputStyle = { borderColor: "var(--line)" } as const;

/** Quick picks for PAINT mode's color; any other color via the native picker. */
const PAINT_SWATCHES = [
  { hex: "#c2185b", name: "ורוד פוקסיה" },
  { hex: "#d32f2f", name: "אדום" },
  { hex: "#ef6c00", name: "כתום" },
  { hex: "#f9a825", name: "צהוב" },
  { hex: "#2e7d32", name: "ירוק" },
  { hex: "#1565c0", name: "כחול" },
  { hex: "#6a1b9a", name: "סגול" },
  { hex: "#212121", name: "שחור" },
  { hex: "#c9a227", name: "זהב" },
];

type HeightUnit = "cm" | "mm" | "in";
const UNIT_TO_CM: Record<HeightUnit, number> = { cm: 1, mm: 0.1, in: 2.54 };

/** Mode 0 — upload an image + set physical book parameters, then generate. */
/**
 * `children` is server-rendered content (the homepage's intro for search
 * engines and first-time visitors), shown under the tool, above the footer.
 */
export default function ConfigPanel({ children }: { children?: ReactNode }) {
  const { config, setConfig, loadPattern, pattern, sourceImage, thumbnail, foldedPages, setView } = useStore();
  const { user, getToken } = useAuth();
  const { refresh: refreshSubscription } = useSubscription();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Restore the previously-uploaded image (and its preview) when returning to
  // this screen without a fresh upload - e.g. generate a pattern, then click
  // "הגדרות" to tweak page height and come back. Runs once on mount; a
  // genuinely new file picked via onFile always takes priority afterward.
  useEffect(() => {
    if (file || !sourceImage) return;
    setPreviewUrl(sourceImage);
    fetch(sourceImage)
      .then((r) => r.blob())
      .then((blob) => setFile(new File([blob], "uploaded-image.png", { type: blob.type || "image/png" })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [heightUnit, setHeightUnit] = useState<HeightUnit>("cm");
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [preview3D, setPreview3D] = useState<{ pattern: FoldingPattern; coverImageUrl: string | null } | null>(null);
  const [busy3D, setBusy3D] = useState(false);
  const [subscribeReason, setSubscribeReason] = useState<string | null>(null);

  const onSave = async () => {
    if (!user || !pattern) return;
    setSaving(true);
    try {
      const name =
        prompt("שם לתבנית:", "תבנית קיפול") || "תבנית קיפול";
      await savePattern(user.uid, name, pattern, thumbnail);
      setSaved(true);
    } catch (e) {
      // Surface the real Firebase error code (e.g. "permission-denied",
      // "unavailable") instead of a generic message - without it there's no
      // way to tell a rules/config problem from a network hiccup.
      const code = e instanceof Error && "code" in e ? String((e as { code: unknown }).code) : null;
      setError(code ? `השמירה נכשלה (${code}). נסו שוב.` : "השמירה נכשלה. נסו שוב.");
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

  // Generating needs sign-in and an active monthly pass; with one, every
  // pattern is included. The server route re-checks the pass and returns the
  // authoritative pattern.
  const onGenerate = async () => {
    setError(null);
    setShowGate(false);
    if (!validate() || !file) return;
    if (!user) {
      setShowGate(true);
      return;
    }
    // No client-side pre-check on the cached pass status: it can be stale
    // right after paying, and the server (which also claims a just-arrived
    // payment) answers 402 if there really is no active pass.
    setBusy(true);
    try {
      const [thumb, sourceImg] = await Promise.all([
        makeThumbnail(file),
        // Same maxEdge as extractPixelGrid, so this lines up 1:1 with the
        // algorithm's own working resolution - sharp enough for GridEditor's
        // per-leaf zoom, and also doubles as the "remembered image" restored
        // in ConfigPanel when navigating back without a fresh upload. JPEG
        // (not PNG) at this size - see makeThumbnail's docs on why.
        makeThumbnail(file, 1600, "image/jpeg", 0.88),
      ]);
      const token = await getToken();
      const form = new FormData();
      form.set("image", file);
      form.set("config", JSON.stringify(config));
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          refreshSubscription();
          setSubscribeReason("כדי ליצור תבניות צריך מנוי פעיל. עם המנוי - כמה תבניות שרוצים כל החודש.");
        } else {
          setError(json.error || "יצירת התבנית נכשלה. נסו שוב.");
        }
        return;
      }
      loadPattern(json.pattern, thumb, sourceImg);
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
        <img src="/assets/mekapele-logo.png" alt="מקפלא - מחולל תבניות לפיסול ספרים" className="h-9 w-auto" />
        <div className="flex-1">
          <p className="text-sm text-[var(--ink-soft)]">ע״י האמנית והיזמית להב ברק</p>
        </div>
        <button
          onClick={() => setView("patterns")}
          className="text-sm px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--line)" }}
        >
          התבניות שלי
        </button>
        <SubscriptionBadge />
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
            גררו לכאן קובץ JPG / PNG בשחור-לבן או גווני אפור.{" "}
            <InfoTip text="הכי טוב: צללית או טקסט בשחור מלא על רקע לבן נקי, בלי צללים. כל מה שבשחור יהפוך לקיפול. רוחב התמונה מתחלק לפי מספר הדפים, וגובהה לפי המרווח האנכי." />
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
          <Field
            label="עמוד ראשון"
            hint="תחילת טווח הקיפול, למשל 41."
            info="מספר העמוד המודפס בספר שממנו מתחילים לקפל. מומלץ להשאיר כמה עשרות עמודים ריקים בתחילת הספר כדי שהכריכה תיסגר יפה. כל דף בספר = 2 עמודים, ולכן מספרי העמודים בתבנית קופצים ב-2."
          >
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
          <Field
            label="עמוד אחרון"
            hint="סוף טווח הקיפול, למשל 360."
            info="מספר העמוד האחרון שמקפלים. ככל שהטווח גדול יותר יש יותר דפים (עלים) - והתמונה מתקבלת רחבה ומפורטת יותר."
          >
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

        <Field
          label="גובה העמוד"
          hint="הגובה הפיזי של עמוד אחד."
          info="מודדים בסרגל את גובה הדף מלמעלה עד למטה (לא את הכריכה). כל המידות בתבנית נמדדות מהקצה העליון של הדף."
        >
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
          label="שיטת קיפול"
          info="סימון וקיפול (MMF): מסמנים בכל דף נקודה עליונה ותחתונה ומקפלים את הקצוות פנימה - התמונה מתקבלת כתבליט. גזירה וקיפול: גוזרים בין זוגות הסימונים ומקפלים לסירוגין - מאפשר פרטים עדינים יותר וכמה צורות על אותו דף. צביעה: בלי גזירה ובלי קיפול - צובעים את קצה הדף בין זוגות הסימונים בצבע שבוחרים, והתמונה מופיעה בצבע על חזית הספר."
        >
          <select
            className={inputClass}
            style={inputStyle}
            value={config.mode}
            onChange={(e) => setConfig({ mode: e.target.value as FoldingMode })}
          >
            <option value="MMF">סימון וקיפול (MMF)</option>
            <option value="CUT_AND_FOLD">גזירה וקיפול</option>
            <option value="PAINT">צביעה (חדש!)</option>
          </select>
        </Field>

        {config.mode === "PAINT" && (
          <Field
            label="באיזה צבע לצבוע?"
            hint="הצבע שיופיע במקום הגזירה - רואים אותו גם בתצוגת ה-3D."
            info="במקום לגזור, צובעים את קצה הדף בין שני הסימונים (בטוש, צבע אקרילי או ספוג). כל הקטעים הצבועים יחד יוצרים את התמונה על חזית הספר."
          >
            <div className="flex flex-wrap items-center gap-2">
              {PAINT_SWATCHES.map((sw) => {
                const selected = (config.paintColor || DEFAULT_PAINT_COLOR).toLowerCase() === sw.hex;
                return (
                  <button
                    key={sw.hex}
                    type="button"
                    title={sw.name}
                    aria-label={sw.name}
                    aria-pressed={selected}
                    onClick={() => setConfig({ paintColor: sw.hex })}
                    className="w-8 h-8 rounded-full border-2"
                    style={{
                      background: sw.hex,
                      borderColor: selected ? "var(--ink)" : "var(--paper)",
                      boxShadow: selected ? "0 0 0 2px var(--paper), 0 0 0 4px var(--ink)" : "0 0 0 1px var(--line)",
                    }}
                  />
                );
              })}
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="color"
                  value={config.paintColor || DEFAULT_PAINT_COLOR}
                  onChange={(e) => setConfig({ paintColor: e.target.value })}
                  className="h-8 w-10 rounded border-0 bg-transparent cursor-pointer"
                  aria-label="צבע אחר"
                />
                צבע אחר
              </label>
            </div>
          </Field>
        )}

        {config.mode === "MMF" && (
          <Field
            label="קווי MMF"
            hint="כמה קווי קיפול עצמאיים, אחד מעל השני, יכולים להופיע על אותו עלה."
            info="בקו אחד כל דף מקבל קיפול אחד בלבד. עם 2-3 קווים, צורות נפרדות (למשל שתי אותיות אחת מעל השנייה) מקופלות על אותו דף - התוצאה מדויקת יותר אבל הקיפול מורכב יותר."
          >
            <select
              className={inputClass}
              style={inputStyle}
              value={config.mmfLines ?? 1}
              onChange={(e) => setConfig({ mmfLines: parseInt(e.target.value, 10) })}
            >
              <option value={1}>קו אחד</option>
              <option value={2}>2 קווים</option>
              <option value={3}>3 קווים</option>
            </select>
          </Field>
        )}

        <Field
          label="שפת הספר / כיוון"
          hint="LTR לאנגלית · RTL לעברית / ערבית."
          info="קובע מאיזה צד של התמונה מתחילים: בספר בעברית עמוד 1 נמצא בצד ימין של התמונה, ובספר באנגלית - בצד שמאל. משנה את מספרי העמודים בטבלה; מפת הקיפולים נשארת אותה תמונה."
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
      <span className="mr-2">
        <InfoTip text="הגדרות מתקדמות לכיוונון התוצאה. ברירות המחדל מתאימות לרוב התמונות." />
      </span>

      {showMoreOptions && (
        <div className="mb-6 space-y-5 rounded-[var(--radius)] p-4 border" style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}>
          <Field
            label={`מרווח אנכי (${config.verticalSpacingCm.toFixed(1)} ס״מ)`}
            hint="כמה גבוה תוצג התמונה על העמוד. התמונה שומרת על יחס הממדים שלה ותמורכז - לא תימתח."
            info="הגובה של התמונה המקופלת עצמה. למשל בדף של 22 ס״מ ומרווח של 14.5 ס״מ - התמונה תתפוס 14.5 ס״מ באמצע הדף, עם שוליים שווים למעלה ולמטה."
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
              <InfoTip text="מסיר שוליים לבנים מימין ומשמאל לתמונה, כך שכל הדפים מנוצלים לציור עצמו ולא מתבזבזים על רקע ריק." />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={config.autoThreshold}
                onChange={(e) => setConfig({ autoThreshold: e.target.checked })}
              />
              סף שחור/לבן אוטומטי
              <InfoTip text="המערכת מחליטה לבד מה נחשב 'שחור' ומה 'לבן' לפי התמונה שלכם. שימושי לתמונות בגווני אפור או לסריקות. בתמונה נקייה בשחור-לבן אין צורך." />
            </label>
          </div>

          <Field
            label={`גודל לשונית מינימלי (${config.minTabSizeMm.toFixed(1)} מ״מ)`}
            hint="לגזירה וקיפול ולצביעה — מתעלם מקטעים דקים מערך זה."
            info="רצועת נייר צרה מדי קשה לגזור ולקפל ונקרעת בקלות, וקטע צבוע דק מדי כמעט לא נראה. כל קטע שחור דק מהערך הזה מושמט מהתבנית."
          >
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              disabled={config.mode === "MMF"}
              className="w-full disabled:opacity-40"
              value={config.minTabSizeMm}
              onChange={(e) =>
                setConfig({ minTabSizeMm: parseFloat(e.target.value) })
              }
            />
          </Field>
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

      {pattern && foldedPages.length > 0 && (
        <p className="mb-3 text-sm" style={{ color: "var(--coral-deep)" }}>
          שימו לב: עדכון התבנית יאפס את סימוני ההתקדמות ({foldedPages.length} עמודים) שסימנתם עד כה במעקב.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Generate: requires sign-in and an active monthly pass. */}
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
        <span className="self-center">
          <InfoTip text="צפו איך הספר ייראה אחרי הקיפול, לפני שיוצרים את התבנית. חינם ולא דורש התחברות." align="end" />
        </span>

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

      {children}

      <Footer />

      {preview3D && (
        <Preview3DModal
          pattern={preview3D.pattern}
          coverImageUrl={preview3D.coverImageUrl}
          onClose={() => setPreview3D(null)}
        />
      )}

      {subscribeReason && (
        <SubscribeModal reason={subscribeReason} onClose={() => setSubscribeReason(null)} />
      )}
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
