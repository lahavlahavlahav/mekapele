"use client";

// =============================================================================
// HEARTS BADGE  — header widget showing the user's remaining hearts
// -----------------------------------------------------------------------------
// Click/hover reveals a popover explaining how the hearts model works, with a
// button to open the purchase modal. Renders nothing for signed-out users.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useHearts } from "@/lib/hooks/useHearts";
import PurchaseModal from "./PurchaseModal";

export default function HeartsBadge() {
  const { user } = useAuth();
  const hearts = useHearts();
  const [open, setOpen] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold tabular"
        style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden>❤️</span>
        {hearts === null ? "…" : `${hearts} לבבות`}
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute left-0 mt-2 w-72 rounded-[var(--radius)] p-4 text-sm z-20"
          style={{
            background: "var(--paper)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
          }}
        >
          <p className="font-display text-base mb-2">איך עובדים הלבבות?</p>
          <ul className="space-y-1 text-[var(--ink-soft)] mb-3">
            <li>תבנית פשוטה (עד 500 קיפולים) = לב 1 (❤️)</li>
            <li>תבנית מורכבת (מעל 500 קיפולים) = 2 לבבות (❤️❤️)</li>
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setShowPurchase(true);
            }}
            className="w-full py-2 rounded-lg font-semibold text-white"
            style={{ background: "var(--coral)" }}
          >
            לרכישת לבבות נוספים
          </button>
        </div>
      )}

      {showPurchase && <PurchaseModal onClose={() => setShowPurchase(false)} />}
    </div>
  );
}
