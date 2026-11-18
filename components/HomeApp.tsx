"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AppView } from "@/lib/store";
import { useStore } from "@/lib/store";
import ConfigPanel from "@/components/ConfigPanel";
import WorkshopTracker from "@/components/tracker/WorkshopTracker";
import GridEditor from "@/components/tracker/GridEditor";
import PrintExport from "@/components/PrintExport";
import MyPatterns from "@/components/MyPatterns";

/**
 * Top-level router between the three views. Waits for the persisted store to
 * rehydrate from LocalStorage before rendering, so a resumed session doesn't
 * flash the config screen. `intro` (server-rendered homepage content) is in
 * the HTML from the start, so search engines always see it, and shows under
 * the config screen once the app loads.
 */
export default function HomeApp({ intro }: { intro: ReactNode }) {
  const view = useStore((s) => s.view);
  const pattern = useStore((s) => s.pattern);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);
  useViewHistory(hydrated);

  if (!hydrated) {
    return (
      <>
        <div className="min-h-[50vh] grid place-items-center text-[var(--ink-soft)]">
          טוען את שולחן העבודה שלך…
        </div>
        <div className="max-w-3xl mx-auto px-4">{intro}</div>
      </>
    );
  }

  if (view === "tracker" && pattern) return <WorkshopTracker />;
  if (view === "editGrid" && pattern) return <GridEditor />;
  if (view === "print" && pattern) return <PrintExport />;
  if (view === "patterns") return <MyPatterns />;
  return <ConfigPanel>{intro}</ConfigPanel>;
}

const viewOf = (state: unknown): AppView =>
  ((state as { mekView?: AppView } | null)?.mekView ?? "config");

/**
 * The views share one URL, so without this the browser's back button would
 * leave the site. Every view other than the settings screen gets its own
 * history entry on top of a "config" entry; pressing back pops to it and the
 * settings come back with the same image (sourceImage is kept in the store).
 */
function useViewHistory(hydrated: boolean) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  /** Set while we call history.back() ourselves, so popstate doesn't fight us. */
  const selfBack = useRef(false);
  const started = useRef(false);

  // Keep the history stack in step with the current view.
  useEffect(() => {
    if (!hydrated) return;
    const h = window.history;
    const current = viewOf(h.state);

    if (!started.current) {
      started.current = true;
      // A resumed session can open straight into the studio: put the settings
      // screen underneath it so back lands there instead of leaving the site.
      h.replaceState({ ...h.state, mekView: "config" }, "");
      if (view !== "config") h.pushState({ mekView: view }, "");
      return;
    }
    if (view === current) return;

    if (view === "config") {
      // An in-app "back to settings" button: drop the studio entry.
      selfBack.current = true;
      h.back();
    } else if (current === "config") {
      h.pushState({ mekView: view }, "");
    } else {
      // Moving between studio views (e.g. tracker -> print): one entry for all.
      h.replaceState({ ...h.state, mekView: view }, "");
    }
  }, [hydrated, view]);

  // Browser back / forward.
  useEffect(() => {
    if (!hydrated) return;
    const onPop = (e: PopStateEvent) => {
      if (selfBack.current) {
        selfBack.current = false;
        return;
      }
      const target = viewOf(e.state);
      const { view: now, pattern } = useStore.getState();
      const next = target !== "config" && target !== "patterns" && !pattern ? "config" : target;
      if (next !== now) setView(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [hydrated, setView]);
}
