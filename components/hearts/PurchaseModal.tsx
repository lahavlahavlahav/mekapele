"use client";

// =============================================================================
// PURCHASE MODAL  — hearts packages, redirects to the Grow payment page
// =============================================================================

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { applyDiscount, getDiscountCode, HEART_PACKAGES } from "@/lib/pricing";

/** Israeli mobile format, e.g. 0501234567 — Grow requires this to create a payment page. */
const IL_MOBILE_RE = /^05\d{8}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Grow requires a first + last name, each at least 2 characters. */
function isValidFullName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 && parts.every((p) => p.length >= 2);
}

export default function PurchaseModal({ onClose }: { onClose: () => void }) {
  const { user, getToken } = useAuth();
  const [fullName, setFullName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

  const phoneValid = IL_MOBILE_RE.test(phone);
  const fullNameValid = isValidFullName(fullName);
  const emailValid = EMAIL_RE.test(email);
  // Client-side preview only — create-checkout re-validates the code and
  // computes the actual charged amount itself, this never decides billing.
  const discount = getDiscountCode(couponCode);

  const onBuy = async (packageId: string) => {
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
    setBusyId(packageId);
    try {
      // Signing in is optional — if we have a token we send it (hearts go
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
          packageId,
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
      setBusyId(null);
    }
  };

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
          <p className="font-display text-xl">רכישת לבבות</p>
          <button
            onClick={onClose}
            aria-label="סגירה"
            className="text-2xl leading-none px-2"
          >
            ×
          </button>
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
            שם, טלפון ואימייל נדרשים ליצירת דף התשלום. לא מחוברות? הלבבות ייזקפו
            אוטומטית לחשבון ברגע שתתחברו עם אותו אימייל.
          </span>
        </label>

        <label className="block mb-4 text-sm">
          <span className="font-semibold block mb-1.5">קוד קופון (אופציונלי)</span>
          <input
            type="text"
            placeholder="למשל NEW10"
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

        <div className="space-y-3 mb-2">
          {HEART_PACKAGES.map((pkg) => {
            const discountedPrice = applyDiscount(pkg.priceIls, discount);
            return (
              <button
                key={pkg.id}
                onClick={() => onBuy(pkg.id)}
                disabled={busyId !== null}
                className="w-full px-4 py-3.5 rounded-[var(--radius)] border text-right disabled:opacity-60"
                style={{
                  borderColor: pkg.popular ? "var(--coral)" : "var(--line)",
                  background: pkg.popular ? "rgba(226,97,74,0.06)" : "var(--paper-2)",
                }}
              >
                <span className="flex items-center justify-between">
                  <span className="font-semibold">
                    {busyId === pkg.id ? "מעביר לתשלום…" : pkg.label}
                  </span>
                  <span className="flex items-center gap-2">
                    {pkg.popular && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: "var(--coral)" }}
                      >
                        הכי משתלם
                      </span>
                    )}
                    {discount ? (
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-xs line-through text-[var(--ink-soft)] tabular">
                          ₪{pkg.priceIls}
                        </span>
                        <span className="font-semibold tabular" style={{ color: "var(--sage)" }}>
                          ₪{discountedPrice}
                        </span>
                      </span>
                    ) : (
                      <span className="font-semibold tabular">₪{pkg.priceIls}</span>
                    )}
                  </span>
                </span>
                <span className="block mt-1 text-xs text-[var(--ink-soft)]">
                  {pkg.subtitle ??
                    `${pkg.hearts} ${pkg.hearts === 1 ? "לב" : "לבבות"} ${"❤️".repeat(Math.min(pkg.hearts, 3))}`}
                </span>
              </button>
            );
          })}
        </div>

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
