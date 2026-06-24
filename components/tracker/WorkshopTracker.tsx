"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import FocusCard from "./FocusCard";
import ProgressBar from "./ProgressBar";
import ImagePreview from "./ImagePreview";

/**
 * Mode 2 — Interactive Digital Tracker.
 * Mobile-first dashboard for real-time folding: focus card, next/prev nav,
 * live image fill, progress gamification. All state auto-persists via the
 * store's LocalStorage middleware, so closing the phone loses nothing.
 */
export default function WorkshopTracker() {
  const {
    pattern,
    thumbnail,
    currentPage,
    foldedPages,
    nextPage,
    prevPage,
    goToPage,
    markCurrentFolded,
    unmarkCurrentFolded,
    setView,
    resetProgress,
  } = useStore();

  // Keyboard nav (desktop): arrows to move, space/enter to mark folded.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "ArrowRight") nextPage();
      else if (e.key === "ArrowLeft") prevPage();
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        markCurrentFolded();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextPage, prevPage, markCurrentFolded]);

  if (!pattern) return null;

  const totalLeaves = pattern.pages.length;
  const measurement = pattern.pages[currentPage - 1];
  const isFolded = foldedPages.includes(currentPage);
  const atStart = currentPage <= 1;
  const atEnd = currentPage >= totalLeaves;

  return (
    <div className="min-h-screen pb-28 sm:pb-8">
      {/* Header */}
      <header className="no-print flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/mekapele-logo.png" alt="Lilou Books" className="h-7 w-auto" />
          <div className="leading-tight">
            <p className="eyebrow">Workshop Mode</p>
            <p className="text-sm font-semibold">
              {pattern.config.totalPages} pages · {pattern.config.direction} ·{" "}
              {pattern.config.mode === "MMF" ? "Measure-Mark-Fold" : "Cut & Fold"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("print")}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--line)" }}
          >
            Print view
          </button>
          <button
            onClick={() => setView("config")}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--line)" }}
          >
            Settings
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: focus + nav */}
        <section className="order-2 lg:order-1">
          <FocusCard
            measurement={measurement}
            totalLeaves={totalLeaves}
            mode={pattern.config.mode}
          />

          {/* Mark folded */}
          <button
            onClick={isFolded ? unmarkCurrentFolded : markCurrentFolded}
            className="mt-4 w-full py-4 rounded-[var(--radius)] text-lg font-semibold transition-colors"
            style={
              isFolded
                ? { background: "var(--sage)", color: "#fff" }
                : { background: "var(--coral)", color: "#fff" }
            }
          >
            {isFolded ? "✓ Folded — tap to undo" : "Mark page folded"}
          </button>

          {/* Desktop nav (mobile uses sticky bar below) */}
          <div className="hidden sm:flex items-center justify-between mt-4 gap-3">
            <NavButton onClick={prevPage} disabled={atStart}>
              ← Previous
            </NavButton>
            <PageJump
              current={currentPage}
              total={totalLeaves}
              onJump={goToPage}
            />
            <NavButton onClick={nextPage} disabled={atEnd}>
              Next →
            </NavButton>
          </div>
        </section>

        {/* Right: preview + progress */}
        <aside className="order-1 lg:order-2 space-y-5">
          <ImagePreview
            thumbnail={thumbnail}
            totalLeaves={totalLeaves}
            currentPage={currentPage}
            foldedPages={foldedPages}
            direction={pattern.config.direction}
          />
          <div
            className="rounded-[var(--radius)] p-5 border"
            style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
          >
            <ProgressBar folded={foldedPages.length} total={totalLeaves} />
            <button
              onClick={resetProgress}
              className="mt-4 text-sm text-[var(--ink-soft)] underline underline-offset-2"
            >
              Reset progress
            </button>
          </div>
        </aside>
      </main>

      {/* Mobile sticky nav */}
      <nav
        className="no-print sm:hidden fixed bottom-0 inset-x-0 px-4 py-3 border-t flex items-center gap-3"
        style={{ borderColor: "var(--line)", background: "var(--paper)" }}
      >
        <NavButton onClick={prevPage} disabled={atStart}>
          ←
        </NavButton>
        <div className="flex-1 text-center font-display tabular text-lg">
          {currentPage}
          <span className="text-[var(--ink-soft)] text-sm"> / {totalLeaves}</span>
        </div>
        <NavButton onClick={nextPage} disabled={atEnd}>
          →
        </NavButton>
      </nav>
    </div>
  );
}

function NavButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-5 py-3 rounded-[var(--radius)] font-semibold border disabled:opacity-35 disabled:cursor-not-allowed"
      style={{ borderColor: "var(--line)", background: "var(--paper)" }}
    >
      {children}
    </button>
  );
}

function PageJump({
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
      Page
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
