"use client";

// =============================================================================
// CONTACT FORM  — submits directly to Formspree, no backend route needed.
// -----------------------------------------------------------------------------
// Requires NEXT_PUBLIC_FORMSPREE_ENDPOINT (e.g. https://formspree.io/f/xxxxxxx)
// — sign up at formspree.io, create a form, and set the env var to its
// endpoint. Not a secret: Formspree's security model relies on their own spam
// filtering, not on hiding this URL (it's always embedded client-side).
// =============================================================================

import { useState, type FormEvent } from "react";

export default function ContactForm() {
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
      if (res.ok) {
        setStatus("sent");
        form.reset();
      } else {
        setStatus("error");
      }
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
        <p className="font-display text-lg mb-1">תודה!</p>
        <p className="text-[var(--ink-soft)]">קיבלנו את הפנייה שלכם ונחזור אליכם בהקדם.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-[var(--radius)] p-5"
      style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
    >
      <label className="block text-sm">
        <span className="font-semibold block mb-1.5">שם</span>
        <input
          type="text"
          name="name"
          required
          className="w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)]"
          style={{ borderColor: "var(--line)" }}
        />
      </label>

      <label className="block text-sm">
        <span className="font-semibold block mb-1.5">אימייל</span>
        <input
          type="email"
          name="email"
          required
          className="w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)]"
          style={{ borderColor: "var(--line)" }}
        />
      </label>

      <label className="block text-sm">
        <span className="font-semibold block mb-1.5">הודעה</span>
        <textarea
          name="message"
          required
          rows={5}
          className="w-full px-3 py-2.5 rounded-lg border bg-[var(--paper)]"
          style={{ borderColor: "var(--line)" }}
        />
      </label>

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full py-3 rounded-[var(--radius)] font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--ink)" }}
      >
        {status === "sending" ? "שולח…" : "שליחה"}
      </button>

      {status === "error" && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
        >
          שליחת ההודעה נכשלה. נסו שוב מאוחר יותר.
        </p>
      )}
    </form>
  );
}
