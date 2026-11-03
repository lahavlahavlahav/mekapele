"use client";

// =============================================================================
// SUBSCRIBE MODAL  — the ₪50 monthly pass, redirects to the Grow payment page
// =============================================================================

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { applyDiscount, getDiscountCode, MONTHLY_PLAN } from "@/lib/pricing";

/** Israeli mobile format, e.g. 0501234567 — Grow requires this to create a payment page. */
const IL_MOBILE_RE = /^05\d{8}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Grow requires a first + last name, each at least 2 characters. */
function isValidFullName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 && parts.every((p) => p.length >= 2);
}

export default function SubscribeModal({
  onClose,
  reason,
}: {
  onClose: () => void;
  /** Optional line explaining why the modal opened (e.g. trying to generate without a pass). */
  reason?: string;
}) {
  const { user, getToken } = useAuth();
  const [fullName, setFullName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

  const phoneValid = IL_MOBILE_RE.test(phone);
  const fullNameValid = isValidFullName(fullName);
  const emailValid = EMAIL_RE.test(email);
  // Client-side preview only — create-checkout re-validates the code and
  // computes the actual charged amount itself, this never decides billing.
  const discount = getDiscountCode(couponCode);
  const price = applyDiscount(MONTHLY_PLAN.priceIls, discount);

  const onBuy = async () => {
    setError(null);
    if (!fullNameValid) {
      setError("נא להזין שם פרטי ושם משפחה (לפחות 2 תווים כל אחד).");
      return;
    }
    if (!phoneValid) {
      setError("נא להזין מספר טלפון נייד ישראלי תקין (לדוגמה 0501234567).");
      return;
    }
    if (!emailValid) {
      setError("נא להזין כתובת אימייל תקינה.");
      return;
    }
    setBusy(true);
    try {
      // Signing in is optional — if we have a token we send it (the pass goes
      // straight to that account), but a missing/expired token doesn't block
      // the purchase: it just becomes a guest checkout identified by email,
      // claimed automatically the next time this email signs in.
      const token = await getToken().catch(() => null);
      const res = await fetch("/api/payment/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          planId: MONTHLY_PLAN.id,
          fullName: fullName.trim(),
          phone,
          email: email.trim(),
          couponCode: couponCode.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.paymentUrl) {
        throw new Error(json.error || "שגיאה ביצירת עסקת התשלום.");
      }
      window.location.href = json.paymentUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה ביצירת עסקת התשלום.");
      setBusy(false);
    }
  };

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
            {discount ? (
              <span className="flex items-baseline gap-1.5">
                <span className="text-xs line-through text-[var(--ink-soft)] tabular">₪{MONTHLY_PLAN.priceIls}</span>
                <span className="font-display text-2xl tabular" style={{ color: "var(--sage)" }}>
                  ₪{price}
                </span>
              </span>
            ) : (
              <span className="font-display text-2xl tabular">₪{MONTHLY_PLAN.priceIls}</span>
            )}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-[var(--ink-soft)]">
            <li>✓ כמה תבניות שרוצים במשך {MONTHLY_PLAN.days} יום</li>
            <li>✓ כל שיטות הקיפול: סימון וקיפול, גזירה וקיפול, וצביעה</li>
            <li>✓ תשלום חד-פעמי לחודש, בלי הוראת קבע - מחדשים רק כשרוצים</li>
          </ul>
        </div>

        <label className="block mb-3 text-sm">
          <span className="font-semibold block mb-1.5">שם מלא</span>
          <input
            type="text"
            placeholder="שם פרטי ושם משפחה"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)]"
            style={{ borderColor: "var(--line)" }}
          />
        </label>

        <label className="block mb-3 text-sm">
          <span className="font-semibold block mb-1.5">מספר טלפון נייד</span>
          <input
            type="tel"
            inputMode="tel"
            placeholder="0501234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
            className="w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)] tabular"
            style={{ borderColor: "var(--line)" }}
          />
        </label>

        <label className="block mb-4 text-sm">
          <span className="font-semibold block mb-1.5">אימייל</span>
          <input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)]"
            style={{ borderColor: "var(--line)" }}
            dir="ltr"
          />
          <span className="block mt-1 text-xs text-[var(--ink-soft)]">
            שם, טלפון ואימייל נדרשים ליצירת דף התשלום. לא מחוברים? המנוי יופעל
            אוטומטית ברגע שתתחברו עם אותו אימייל.
          </span>
        </label>

        <label className="block mb-4 text-sm">
          <span className="font-semibold block mb-1.5">קוד קופון</span>
          <input
            type="text"
            placeholder="NEW10"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)] tabular"
            style={{ borderColor: "var(--line)" }}
            dir="ltr"
          />
          {couponCode.trim() && (
            <span
              className="block mt-1 text-xs font-semibold"
              style={{ color: discount ? "var(--sage)" : "var(--coral-deep)" }}
            >
              {discount ? `קוד ${discount.code} הופעל — ${discount.percentOff}% הנחה` : "קוד לא תקין"}
            </span>
          )}
        </label>

        <button
          onClick={onBuy}
          disabled={busy}
          className="w-full py-3 rounded-[var(--radius)] font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--coral)" }}
        >
          {busy ? "מעביר לתשלום…" : `להצטרפות - ₪${price} לחודש`}
        </button>

        {error && (
          <p
            className="mt-3 text-sm rounded-lg px-3 py-2"
            style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
