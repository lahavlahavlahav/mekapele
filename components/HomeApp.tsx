"use client";

import { useEffect, useState, type ReactNode } from "react";
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
