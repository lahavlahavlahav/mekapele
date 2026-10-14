"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small "i" badge that explains whatever it sits next to. Opens on hover
 * (desktop) and on tap (touch screens, where a native `title` never shows),
 * closes on mouse-leave, outside tap, or Escape.
 */
export default function InfoTip({
  text,
  align = "start",
}: {
  text: React.ReactNode;
  /** Which edge the bubble anchors to - "end" for badges near the left edge of an RTL page. */
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="הסבר"
        aria-expanded={open}
        onClick={(e) => {
          // Inside a <label>, don't let the click fall through to its input.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold cursor-help shrink-0"
        style={{ background: "var(--line)", color: "var(--ink-soft)" }}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute top-full mt-1.5 z-30 w-64 max-w-[80vw] rounded-lg p-3 text-xs font-normal leading-relaxed text-right whitespace-normal ${
            align === "end" ? "left-0" : "right-0"
          }`}
          style={{
            background: "var(--paper)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow)",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
