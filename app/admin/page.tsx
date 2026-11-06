"use client";

// =============================================================================
// ADMIN  — owner-only: grant a subscription by email, and see the last Grow
// webhook deliveries. The API enforces the owner check; this page only hides
// the UI from everyone else.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const OWNER_EMAIL = "lahavbarak430@gmail.com";

interface WebhookLog {
  receivedAt: number;
  keyOk: boolean;
  outcome: string;
  payload: string;
}
interface Credit {
  id: string;
  email: string;
  daysAdded: number;
  claimed: boolean;
  manual?: boolean;
  createdAt: number;
}

const fmt = (ms: number) => new Date(ms).toLocaleString("he-IL");

export default function AdminPage() {
  const { user, getToken } = useAuth();
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(30);
  const [msg, setMsg] = useState<string | null>(null);
  const [data, setData] = useState<{ webhooks: WebhookLog[]; credits: Credit[] } | null>(null);

  const call = useCallback(
    async (init?: RequestInit) => {
      const token = await getToken();
      return fetch("/api/admin", {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
    },
    [getToken]
  );

  const load = useCallback(() => {
    call()
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setData(j))
      .catch(() => {});
  }, [call]);

  useEffect(() => {
    if (user?.email === OWNER_EMAIL) load();
  }, [user, load]);

  if (user?.email !== OWNER_EMAIL) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <p>אין הרשאה לעמוד הזה.</p>
        <Link href="/" className="underline">חזרה לסטודיו</Link>
      </div>
    );
  }

  const grant = async () => {
    setMsg(null);
    const res = await call({ method: "POST", body: JSON.stringify({ email, days }) });
    const j = await res.json().catch(() => ({}));
    setMsg(res.ok ? `נוספו ${days} ימים ל-${email}. יופעל בכניסה הבאה שלהם לאתר.` : j.error || "שגיאה");
    if (res.ok) load();
  };

  const box = { background: "var(--paper-2)", border: "1px solid var(--line)" };
  const input = "w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)]";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <header>
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--coral-deep)" }}>
          ← חזרה לסטודיו
        </Link>
        <h1 className="font-display text-3xl mt-3">ניהול</h1>
      </header>

      <section className="rounded-[var(--radius)] p-5 space-y-3" style={box}>
        <h2 className="font-display text-lg">הפעלת מנוי ידנית</h2>
        <input
          type="email"
          placeholder="האימייל של הלקוח"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
          style={{ borderColor: "var(--line)" }}
          dir="ltr"
        />
        <label className="flex items-center gap-2 text-sm">
          ימים:
          <input
            type="number"
            min={1}
            max={366}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-24 px-3 py-2 rounded-lg border bg-[var(--paper)] tabular"
            style={{ borderColor: "var(--line)" }}
          />
        </label>
        <button
          onClick={grant}
          className="w-full py-2.5 rounded-lg font-semibold text-white"
          style={{ background: "var(--coral)" }}
        >
          הפעלת מנוי
        </button>
        {msg && <p className="text-sm">{msg}</p>}
      </section>

      <section className="rounded-[var(--radius)] p-5" style={box}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg">הודעות אחרונות מ-Grow</h2>
          <button onClick={load} className="text-sm underline">רענון</button>
        </div>
        {!data ? (
          <p className="text-sm">טוען…</p>
        ) : data.webhooks.length === 0 ? (
          <p className="text-sm">עדיין לא הגיעה אף הודעה מ-Grow.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {data.webhooks.map((w) => (
              <li key={w.receivedAt} className="border-t pt-2" style={{ borderColor: "var(--line)" }}>
                <p className="font-semibold">
                  {fmt(w.receivedAt)} · {w.outcome} {w.keyOk ? "" : "· מפתח שגוי"}
                </p>
                <pre dir="ltr" className="mt-1 text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {w.payload}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius)] p-5" style={box}>
        <h2 className="font-display text-lg mb-2">זיכויים אחרונים</h2>
        <ul className="space-y-1 text-sm">
          {data?.credits.map((c) => (
            <li key={c.id}>
              {fmt(c.createdAt)} · <span dir="ltr">{c.email}</span> · {c.daysAdded} ימים ·{" "}
              {c.claimed ? "הופעל" : "ממתין לכניסה"} {c.manual ? "· ידני" : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
