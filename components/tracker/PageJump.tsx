"use client";

/** Numeric leaf/page jump input, shared by WorkshopTracker's fixed nav and GridEditor. */
export default function PageJump({
  current,
  total,
  onJump,
}: {
  current: number;
  total: number;
  onJump: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
      עמוד
      <input
        type="number"
        min={1}
        max={total}
        value={current}
        onChange={(e) => onJump(parseInt(e.target.value || "1", 10))}
        className="w-20 px-2 py-2 rounded-lg border text-center tabular"
        style={{ borderColor: "var(--line)", background: "var(--paper)" }}
      />
    </label>
  );
}
