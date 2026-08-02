"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import FocusCard from "./FocusCard";
import ProgressBar from "./ProgressBar";
import ImagePreview from "./ImagePreview";
import PageJump from "./PageJump";
import { exportPatternPdf } from "@/lib/pdf/exportPdf";

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
      if (e.key === "ArrowRight") prevPage();
      else if (e.key === "ArrowLeft") nextPage();
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

  const goToRandomPage = () => {
    if (totalLeaves <= 1) return;
    let page = Math.floor(Math.random() * totalLeaves) + 1;
    if (page === currentPage) page = (page % totalLeaves) + 1;
    goToPage(page);
  };

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="no-print flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/mekapele-logo.png" alt="Lilou Books" className="h-7 w-auto" />
          <div className="leading-tight">
            <p className="eyebrow">מצב סדנה</p>
            <p className="text-sm font-semibold">
              עמודים {pattern.config.firstPage}–{pattern.config.lastPage} ·{" "}
              {pattern.pages.length} עלים · {pattern.config.direction} ·{" "}
              {pattern.config.mode === "MMF" ? "סימון וקיפול" : "גזירה וקיפול"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportPatternPdf(pattern, "תבנית")}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--line)" }}
          >
            ייצוא PDF
          </button>
          <button
            onClick={() => setView("editGrid")}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--line)" }}
          >
            עריכת סימונים
          </button>
          <button
            onClick={() => setView("print")}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--line)" }}
          >
            תצוגת הדפסה
          </button>
          <button
            onClick={() => setView("config")}
            className="text-sm px-3 py-1.5 rounded-lg border"
            style={{ borderColor: "var(--line)" }}
          >
            הגדרות
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-5 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Big grid: the image/lines are the main event - click any leaf to
            jump straight to it, its gold outline is the "you're here" mark. */}
        <section>
          <ImagePreview
            thumbnail={thumbnail}
            totalLeaves={totalLeaves}
            currentPage={currentPage}
            foldedPages={foldedPages}
            direction={pattern.config.direction}
            pageHeightCm={pattern.config.pageHeightCm}
            verticalSpacingCm={pattern.config.verticalSpacingCm}
            precisionMm={pattern.config.precisionMm}
            pages={pattern.pages}
            onSelectPage={goToPage}
          />
        </section>

        {/* Side panel: measurements for whichever leaf is selected + progress. */}
        <aside className="space-y-5">
          <FocusCard
            measurement={measurement}
            totalLeaves={totalLeaves}
            mode={pattern.config.mode}
            isFolded={isFolded}
            onToggleFold={isFolded ? unmarkCurrentFolded : markCurrentFolded}
          />
          <div
            className="rounded-[var(--radius)] p-5 border"
            style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
          >
            <ProgressBar folded={foldedPages.length} total={totalLeaves} />
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={resetProgress}
                className="text-sm text-[var(--ink-soft)] underline underline-offset-2"
              >
                איפוס התקדמות
              </button>
              <button
                onClick={goToRandomPage}
                className="text-sm text-[var(--ink-soft)] underline underline-offset-2"
              >
                עמוד אקראי
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Fixed nav bar - constant physical position at every breakpoint, so the
          Next/Prev buttons never move regardless of FocusCard's variable height. */}
      <nav
        className="no-print fixed bottom-0 inset-x-0 px-4 py-3 border-t flex items-center gap-3"
        style={{ borderColor: "var(--line)", background: "var(--paper)" }}
      >
        <div className="max-w-5xl mx-auto w-full flex items-center gap-3">
          <NavButton onClick={prevPage} disabled={atStart}>
            → הקודם
          </NavButton>
          <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
            <span className="font-display tabular text-lg whitespace-nowrap">
              {currentPage}
              <span className="text-[var(--ink-soft)] text-sm"> / {totalLeaves}</span>
            </span>
            {/* PageJump needs more horizontal room than the smallest phones have
                alongside both nav buttons in one row - keep it desktop/tablet only,
                mobile keeps the compact counter (as before this bar was unified). */}
            <div className="hidden sm:block">
              <PageJump current={currentPage} total={totalLeaves} onJump={goToPage} />
            </div>
          </div>
          <NavButton onClick={nextPage} disabled={atEnd}>
            הבא ←
          </NavButton>
        </div>
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
      className="shrink-0 whitespace-nowrap px-5 py-3 rounded-[var(--radius)] font-semibold border disabled:opacity-35 disabled:cursor-not-allowed"
      style={{ borderColor: "var(--line)", background: "var(--paper)" }}
    >
      {children}
    </button>
  );
}
