"use client";

interface ProgressBarProps {
  folded: number;
  total: number;
}

/** Prominent completion gauge for the workshop's gamification loop. */
export default function ProgressBar({ folded, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((folded / total) * 100) : 0;
  const done = total > 0 && folded >= total;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="eyebrow">Progress</span>
        <span className="font-display tabular text-2xl text-[var(--ink)]">
          {pct}
          <span className="text-base text-[var(--ink-soft)]">%</span>
        </span>
      </div>

      <div
        className="h-3 w-full rounded-full overflow-hidden"
        style={{ background: "var(--line)" }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${folded} of ${total} pages folded`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: done
              ? "var(--sage)"
              : "linear-gradient(90deg, var(--coral), var(--gold))",
          }}
        />
      </div>

      <p className="mt-2 text-sm text-[var(--ink-soft)] tabular">
        {done ? (
          <span className="text-[var(--sage)] font-semibold">
            Finished — every page folded. 🎉
          </span>
        ) : (
          <>
            {folded} of {total} pages folded
          </>
        )}
      </p>
    </div>
  );
}
