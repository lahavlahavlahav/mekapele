"use client";

// =============================================================================
// SUBSCRIPTION BADGE  — header widget showing the monthly-pass status
// -----------------------------------------------------------------------------
// Active: "מנוי פעיל עד <date>". Otherwise a button that opens the subscribe
// modal. Click/hover reveals a short explanation of the plan. Renders nothing
// for signed-out users.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { formatUntil, useSubscription } from "@/lib/hooks/useSubscription";
import { MONTHLY_PLAN } from "@/lib/pricing";
import SubscribeModal from "./SubscribeModal";

export default function SubscriptionBadge() {
  const { user } = useAuth();
  const { status } = useSubscription();
  const [open, setOpen] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);
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
  const active = !!status?.active;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold tabular"
        style={
          active
            ? { borderColor: "var(--sage)", background: "var(--paper-2)" }
            : { borderColor: "var(--coral)", background: "rgba(226,97,74,0.08)" }
        }
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {status === null
          ? "…"
          : active
          ? `✓ מנוי עד ${formatUntil(status.activeUntil)}`
          : `מנוי ₪${MONTHLY_PLAN.priceIls}`}
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
          <p className="font-display text-base mb-2">איך עובד המנוי?</p>
          <ul className="space-y-1 text-[var(--ink-soft)] mb-3">
            <li>
              ₪{MONTHLY_PLAN.priceIls} ל-{MONTHLY_PLAN.days} יום - תבניות ללא הגבלה.
            </li>
            <li>
              תשלום חודשי, מבטלים מתי שרוצים -{" "}
              <Link href="/cancel" className="underline font-semibold">
                בלחיצה כאן
              </Link>
            </li>
            {status && status.activeUntil > 0 && (
              <li className="font-semibold text-[var(--ink)]">
                {active ? "המנוי שלך פעיל עד " : "המנוי שלך הסתיים ב-"}
                {formatUntil(status.activeUntil)}
              </li>
            )}
          </ul>
          {!active && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowSubscribe(true);
              }}
              className="w-full py-2 rounded-lg font-semibold text-white"
              style={{ background: "var(--coral)" }}
            >
              להצטרפות למנוי
            </button>
          )}
        </div>
      )}

      {showSubscribe && <SubscribeModal onClose={() => setShowSubscribe(false)} />}
    </div>
  );
}
