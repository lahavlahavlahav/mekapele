"use client";

// =============================================================================
// PURCHASE MODAL  — hearts packages, redirects to the Grow payment page
// =============================================================================

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { HEART_PACKAGES } from "@/lib/pricing";

/** Israeli mobile format, e.g. 0501234567 — Grow requires this to create a payment page. */
const IL_MOBILE_RE = /^05\d{8}$/;

/** Grow requires a first + last name, each at least 2 characters. */
function isValidFullName(name: string): boolean {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 && parts.every((p) => p.length >= 2);
}

export default function PurchaseModal({ onClose }: { onClose: () => void }) {
  const { user, getToken } = useAuth();
  const [fullName, setFullName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const phoneValid = IL_MOBILE_RE.test(phone);
  const fullNameValid = isValidFullName(fullName);

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
    setBusyId(packageId);
    try {
      const token = await getToken();
      const res = await fetch("/api/payment/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ packageId, fullName: fullName.trim(), phone }),
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

        <label className="block mb-4 text-sm">
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
          <span className="block mt-1 text-xs text-[var(--ink-soft)]">
            שם וטלפון נדרשים ליצירת דף התשלום.
          </span>
        </label>

        <div className="space-y-3 mb-2">
          {HEART_PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => onBuy(pkg.id)}
              disabled={busyId !== null}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-[var(--radius)] border text-right disabled:opacity-60"
              style={{
                borderColor: pkg.popular ? "var(--coral)" : "var(--line)",
                background: pkg.popular ? "rgba(226,97,74,0.06)" : "var(--paper-2)",
              }}
            >
              <span className="font-semibold">
                {busyId === pkg.id ? "מעביר לתשלום…" : `₪${pkg.priceIls}`}
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
                <span>
                  {pkg.hearts} {pkg.hearts === 1 ? "לב" : "לבבות"} {"❤️".repeat(Math.min(pkg.hearts, 3))}
                </span>
              </span>
            </button>
          ))}
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
