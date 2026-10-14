"use client";

import InfoTip from "./InfoTip";

interface FieldProps {
  label: React.ReactNode;
  hint?: string;
  /** Longer explanation shown in a hover/tap bubble next to the label. */
  info?: React.ReactNode;
  children: React.ReactNode;
}

export default function Field({ label, hint, info, children }: FieldProps) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-sm font-semibold mb-1.5">
        {label}
        {info && <InfoTip text={info} />}
      </span>
      {children}
      {hint && <span className="block text-xs text-[var(--ink-soft)] mt-1">{hint}</span>}
    </label>
  );
}
