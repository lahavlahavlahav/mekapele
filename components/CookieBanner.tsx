"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OPEN_CONSENT_EVENT, readConsent, saveConsent, type ConsentChoice } from "@/lib/consent";

export default function CookieBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (choice: ConsentChoice) => {
    saveConsent(choice);
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="הסכמה לעוגיות"
      dir="rtl"
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm rounded-[var(--radius)] p-4 text-sm"
      style={{ background: "var(--paper)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
    >
      <p className="font-semibold mb-1">האתר משתמש בעוגיות</p>
      <p className="text-[var(--ink-soft)] mb-3 leading-relaxed">
        אנחנו משתמשים ב-Google Analytics כדי להבין כמה אנשים מבקרים באתר ואיך משתמשים בו, וכך
        לשפר אותו. העוגיות האלה נשמרות רק אם תאשרו.{" "}
        <Link href="/terms" className="underline">
          מדיניות פרטיות
        </Link>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => choose("granted")}
          className="flex-1 py-2 rounded-lg font-semibold text-white"
          style={{ background: "var(--ink)" }}
        >
          אישור
        </button>
        <button
          type="button"
          onClick={() => choose("denied")}
          className="flex-1 py-2 rounded-lg font-semibold border"
          style={{ borderColor: "var(--line)" }}
        >
          דחייה
        </button>
      </div>
    </div>
  );
}

export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      הגדרות עוגיות
    </button>
  );
}
