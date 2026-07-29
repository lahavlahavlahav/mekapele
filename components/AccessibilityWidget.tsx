"use client";

// =============================================================================
// ACCESSIBILITY WIDGET  — floating button + real, functional adjustments
// -----------------------------------------------------------------------------
// Font size, high contrast, underlined links, reduced motion. Persists to
// localStorage and applies via data-attributes on <html> (see globals.css).
// Paired with the accessibility statement at /accessibility.
// =============================================================================

import { useEffect, useState } from "react";
import Link from "next/link";

type FontSize = "normal" | "lg" | "xl";
type OnOff = "off" | "on";

interface A11yState {
  font: FontSize;
  contrast: OnOff;
  underline: OnOff;
  motion: OnOff;
}

const DEFAULT_STATE: A11yState = {
  font: "normal",
  contrast: "off",
  underline: "off",
  motion: "off",
};

const STORAGE_KEY = "mekapele-a11y-v1";

function applyToDocument(state: A11yState) {
  const root = document.documentElement;
  if (state.font === "normal") root.removeAttribute("data-a11y-font");
  else root.setAttribute("data-a11y-font", state.font);

  if (state.contrast === "on") root.setAttribute("data-a11y-contrast", "high");
  else root.removeAttribute("data-a11y-contrast");

  if (state.underline === "on") root.setAttribute("data-a11y-underline", "true");
  else root.removeAttribute("data-a11y-underline");

  if (state.motion === "on") root.setAttribute("data-a11y-motion", "reduce");
  else root.removeAttribute("data-a11y-motion");
}

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<A11yState>(DEFAULT_STATE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = { ...DEFAULT_STATE, ...JSON.parse(saved) } as A11yState;
        setState(parsed);
        applyToDocument(parsed);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const update = (patch: Partial<A11yState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      applyToDocument(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable — still applies for this session
      }
      return next;
    });
  };

  const reset = () => update(DEFAULT_STATE);

  return (
    <div className="fixed bottom-4 left-4 z-40" dir="rtl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="אפשרויות נגישות"
        className="w-12 h-12 rounded-full grid place-items-center text-xl text-white"
        style={{ background: "var(--ink)", boxShadow: "var(--shadow)" }}
      >
        <span aria-hidden>♿</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="אפשרויות נגישות"
          className="absolute bottom-14 left-0 w-72 rounded-[var(--radius)] p-4 text-sm"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
          }}
        >
          <p className="font-display text-base mb-3">נגישות</p>

          <fieldset className="mb-3">
            <legend className="font-semibold mb-1.5">גודל טקסט</legend>
            <div className="flex gap-2">
              {(["normal", "lg", "xl"] as FontSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => update({ font: size })}
                  aria-pressed={state.font === size}
                  className="flex-1 py-1.5 rounded-lg border text-xs font-semibold"
                  style={{
                    borderColor: state.font === size ? "var(--ink)" : "var(--line)",
                    background: state.font === size ? "var(--paper-2)" : "transparent",
                  }}
                >
                  {size === "normal" ? "רגיל" : size === "lg" ? "גדול" : "גדול מאוד"}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center justify-between mb-2">
            <span>ניגודיות גבוהה</span>
            <input
              type="checkbox"
              checked={state.contrast === "on"}
              onChange={(e) => update({ contrast: e.target.checked ? "on" : "off" })}
            />
          </label>

          <label className="flex items-center justify-between mb-2">
            <span>הדגשת קישורים</span>
            <input
              type="checkbox"
              checked={state.underline === "on"}
              onChange={(e) => update({ underline: e.target.checked ? "on" : "off" })}
            />
          </label>

          <label className="flex items-center justify-between mb-3">
            <span>עצירת אנימציות</span>
            <input
              type="checkbox"
              checked={state.motion === "on"}
              onChange={(e) => update({ motion: e.target.checked ? "on" : "off" })}
            />
          </label>

          <div className="flex items-center justify-between">
            <button onClick={reset} className="text-xs font-semibold" style={{ color: "var(--coral-deep)" }}>
              איפוס
            </button>
            <Link href="/accessibility" className="text-xs font-semibold underline">
              הצהרת נגישות
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
