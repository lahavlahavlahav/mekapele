"use client";

// =============================================================================
// PURCHASE MODAL  — hearts packages, redirects to the Grow payment page
// =============================================================================

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { HEART_PACKAGES } from "@/lib/pricing";

export default function PurchaseModal({ onClose }: { onClose: () => void }) {
  const { getToken } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onBuy = async (packageId: string) => {
    setError(null);
    setBusyId(packageId);
    try {
      const token = await getToken();
      const res = await fetch("/api/payment/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ packageId }),
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
