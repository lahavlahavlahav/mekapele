"use client";

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export default function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[var(--ink-soft)] mt-1">{hint}</span>}
    </label>
  );
}
