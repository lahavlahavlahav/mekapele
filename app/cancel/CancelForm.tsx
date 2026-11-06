"use client";

// =============================================================================
// CANCEL FORM  — standing-order cancellation request, sent to Formspree (same
// endpoint as the contact form). Cancelling in Grow itself is done by hand
// from the Grow dashboard: doing it automatically needs Grow's paid API.
// =============================================================================

import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function CancelForm() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!endpoint) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    const form = e.currentTarget;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div
        className="rounded-[var(--radius)] p-5 text-center"
        style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
      >
        <p className="font-display text-lg mb-1">בקשת הביטול התקבלה</p>
        <p className="text-[var(--ink-soft)]">
          הוראת הקבע תבוטל ולא יהיו חיובים נוספים. אישור יישלח אליכם במייל. המנוי
          ממשיך לפעול עד סוף החודש ששולם.
        </p>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)]";

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-[var(--radius)] p-5"
      style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
    >
      <input type="hidden" name="_subject" value="ביטול הוראת קבע - מנוי מקפלא" />
      <input type="hidden" name="type" value="ביטול מנוי" />

      <label className="block text-sm">
        <span className="font-semibold block mb-1.5">שם מלא</span>
        <input type="text" name="name" required className={inputClass} style={{ borderColor: "var(--line)" }} />
      </label>

      <label className="block text-sm">
        <span className="font-semibold block mb-1.5">האימייל שאיתו שילמתם</span>
        <input
          type="email"
          name="email"
          required
          defaultValue={user?.email ?? ""}
          className={inputClass}
          style={{ borderColor: "var(--line)" }}
          dir="ltr"
        />
      </label>

      <label className="block text-sm">
        <span className="font-semibold block mb-1.5">טלפון נייד</span>
        <input
          type="tel"
          name="phone"
          inputMode="tel"
          required
          pattern="05\d{8}"
          placeholder="0501234567"
          className={`${inputClass} tabular`}
          style={{ borderColor: "var(--line)" }}
        />
      </label>

      <label className="block text-sm">
        <span className="font-semibold block mb-1.5">למה מבטלים? (לא חובה)</span>
        <textarea name="reason" rows={3} className={inputClass} style={{ borderColor: "var(--line)" }} />
      </label>

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-3 rounded-[var(--radius)] font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--coral)" }}
      >
        {status === "sending" ? "שולח…" : "ביטול הוראת הקבע"}
      </button>

      {status === "error" && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
        >
          השליחה נכשלה. נסו שוב, או כתבו לנו דרך עמוד יצירת הקשר.
        </p>
      )}
    </form>
  );
}
