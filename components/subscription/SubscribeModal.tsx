"use client";

// =============================================================================
// SUBSCRIBE MODAL  — the ₪50 monthly pass, sends the buyer to the fixed Grow
// payment page. The Grow webhook matches the payment to an account by the
// email typed on that page, so the modal asks to use the account's email.
// =============================================================================

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { GROW_MONTHLY_PAYMENT_URL, MONTHLY_PLAN } from "@/lib/pricing";

export default function SubscribeModal({
  onClose,
  reason,
}: {
  onClose: () => void;
  /** Optional line explaining why the modal opened (e.g. trying to generate without a pass). */
  reason?: string;
}) {
  const { user } = useAuth();

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(29,36,51,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[var(--radius)] p-6"
        style={{ background: "var(--paper)", boxShadow: "var(--shadow)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-xl">{MONTHLY_PLAN.label}</p>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {reason && (
          <p
            className="mb-3 text-sm rounded-lg px-3 py-2"
            style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
          >
            {reason}
          </p>
        )}

        <div
          className="mb-4 rounded-[var(--radius)] border p-4"
          style={{ borderColor: "var(--coral)", background: "rgba(226,97,74,0.06)" }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">תבניות ללא הגבלה</span>
            <span className="font-display text-2xl tabular">₪{MONTHLY_PLAN.priceIls}</span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-[var(--ink-soft)]">
            <li>✓ כמה תבניות שרוצים במשך {MONTHLY_PLAN.days} יום</li>
            <li>✓ כל שיטות הקיפול: סימון וקיפול, גזירה וקיפול, וצביעה</li>
            <li>✓ הוראת קבע חודשית - אפשר לבטל מתי שרוצים</li>
          </ul>
        </div>

        <p
          className="mb-4 text-sm rounded-lg px-3 py-2.5"
          style={{ background: "rgba(122,154,130,0.14)" }}
        >
          <span className="font-semibold">חשוב:</span> בדף התשלום יש להזין את אותו
          אימייל שאיתו נכנסים לאתר
          {user?.email ? (
            <>
              {" - "}
              <span dir="ltr" className="font-semibold">
                {user.email}
              </span>
            </>
          ) : (
            " (לא מחוברים? התחברו אחר כך עם אותו אימייל)"
          )}
          . כך המנוי מופעל אוטומטית תוך דקה מהתשלום.
        </p>

        <a
          href={GROW_MONTHLY_PAYMENT_URL}
          className="block w-full py-3 rounded-[var(--radius)] font-semibold text-white text-center"
          style={{ background: "var(--coral)" }}
        >
          {`להצטרפות - ₪${MONTHLY_PLAN.priceIls} לחודש`}
        </a>

        <p className="mt-3 text-xs text-center text-[var(--ink-soft)]">
          ניתן לבטל מתי שרוצים -{" "}
          <Link href="/cancel" className="underline font-semibold" onClick={onClose}>
            בלחיצה כאן
          </Link>
        </p>
      </div>
    </div>
  );
}
