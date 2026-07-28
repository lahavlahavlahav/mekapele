"use client";

// =============================================================================
// CONFIRM GENERATE MODAL
// -----------------------------------------------------------------------------
// Shown before spending hearts: image preview, fold count, complexity, cost,
// and the user's current balance. Either offers to confirm & generate, or —
// if the balance is short — warns and links to the purchase modal.
// =============================================================================

import { useState } from "react";
import type { PatternComplexity } from "@/lib/pricing";
import PurchaseModal from "./PurchaseModal";

const COMPLEXITY_LABEL: Record<PatternComplexity, string> = {
  simple: "תבנית פשוטה",
  complex: "תבנית מורכבת",
};

export default function ConfirmGenerateModal({
  previewUrl,
  foldCount,
  complexity,
  requiredHearts,
  currentHearts,
  busy,
  onConfirm,
  onClose,
}: {
  previewUrl: string | null;
  foldCount: number;
  complexity: PatternComplexity;
  requiredHearts: number;
  currentHearts: number;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [showPurchase, setShowPurchase] = useState(false);
  const canAfford = currentHearts >= requiredHearts;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(29,36,51,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius)] p-6"
        style={{ background: "var(--paper)", boxShadow: "var(--shadow)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-xl">אישור יצירת תבנית</p>
          <button onClick={onClose} aria-label="סגירה" className="text-2xl leading-none px-2">
            ×
          </button>
        </div>

        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="התמונה שהועלתה"
            className="max-h-40 mx-auto rounded-lg mb-4 object-contain"
          />
        )}

        <div
          className="rounded-lg p-3 mb-4 text-sm space-y-1"
          style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
        >
          <div className="flex justify-between">
            <span className="text-[var(--ink-soft)]">סה״כ קיפולים</span>
            <span className="font-semibold tabular">{foldCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ink-soft)]">סיווג</span>
            <span className="font-semibold">{COMPLEXITY_LABEL[complexity]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ink-soft)]">עלות ליצירה</span>
            <span className="font-semibold">
              {requiredHearts} {requiredHearts === 1 ? "לב" : "לבבות"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--ink-soft)]">ברשותך</span>
            <span className="font-semibold tabular">{currentHearts} לבבות</span>
          </div>
        </div>

        {canAfford ? (
          <button
            onClick={onConfirm}
            disabled={busy}
            className="w-full py-3 rounded-[var(--radius)] font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--ink)" }}
          >
            {busy ? "יוצר תבנית…" : "אשר ויצור תבנית"}
          </button>
        ) : (
          <div
            className="rounded-lg p-3 text-sm text-center"
            style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
          >
            <p className="font-semibold mb-2">אין מספיק לבבות בחשבונך</p>
            <button
              onClick={() => setShowPurchase(true)}
              className="px-4 py-2 rounded-lg font-semibold text-white"
              style={{ background: "var(--coral)" }}
            >
              לרכישת לבבות נוספים
            </button>
          </div>
        )}
      </div>

      {showPurchase && <PurchaseModal onClose={() => setShowPurchase(false)} />}
    </div>
  );
}
