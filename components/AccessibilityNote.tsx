"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DISMISS_KEY = "mekapele-a11y-note-dismissed";

/**
 * A small yellow "sticky note" stuck above the accessibility button, inviting
 * visitors to suggest accessibility improvements (links to /contact).
 * Dismissable; the dismissal is remembered per browser.
 */
export default function AccessibilityNote() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // storage blocked: hidden for this page view only
    }
  };

  return (
    <aside
      dir="rtl"
      aria-label="הצעות לנגישות"
      className="fixed bottom-20 left-4 z-40 w-40 sm:w-44 -rotate-3"
      style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.18))" }}
    >
      {/* Strip of tape holding the note */}
      <span
        aria-hidden
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-4 rotate-2"
        style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(0,0,0,0.06)" }}
      />
      <div
        className="relative px-3.5 pt-4 pb-3 text-sm leading-snug"
        style={{
          background: "linear-gradient(160deg, #fff7a8 0%, #ffe970 100%)",
          color: "#3b3320",
          borderBottomRightRadius: "14px 6px",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="סגירת הפתק"
          className="absolute top-1 left-1.5 w-6 h-6 grid place-items-center rounded-full text-base opacity-60 hover:opacity-100"
        >
          ×
        </button>
        <Link href="/contact" className="block font-semibold hover:underline">
          יש משהו שאפשר לעשות נגיש יותר באתר? תכתבי לי!
        </Link>
      </div>
    </aside>
  );
}
