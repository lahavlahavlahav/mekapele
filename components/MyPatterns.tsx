"use client";

// =============================================================================
// MY PATTERNS — dashboard listing the user's saved patterns
// -----------------------------------------------------------------------------
// Fetches users/{uid}/patterns, shows them as cards with quick actions:
// open in Workshop tracker, export PDF, or delete. Requires sign-in.
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import { useStore } from "@/lib/store";
import {
  listPatterns,
  deletePattern,
  type SavedPattern,
} from "@/lib/firestore/patterns";
import { exportPatternPdf } from "@/lib/pdf/exportPdf";
import { LoginGate, UserBadge } from "./LoginGate";

export default function MyPatterns() {
  const { user, loading: authLoading } = useAuth();
  const { loadPattern, setView } = useStore();
  const [items, setItems] = useState<SavedPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await listPatterns(user.uid));
    } catch {
      setError("לא ניתן לטעון את התבניות השמורות.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
    else if (!authLoading) setLoading(false);
  }, [user, authLoading, refresh]);

  const onOpen = (sp: SavedPattern) => {
    // Hydrate the store with the saved pattern + progress, then open tracker.
    loadPattern(sp.pattern, sp.pattern.imageWidth ? null : null);
    useStore.setState({
      currentPage: sp.currentPage,
      foldedPages: sp.foldedPages,
      view: "tracker",
    });
    setView("tracker");
  };

  const onDelete = async (sp: SavedPattern) => {
    if (!user) return;
    if (!confirm(`למחוק את "${sp.name}"?`)) return;
    await deletePattern(user.uid, sp.id);
    refresh();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-center gap-3 mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/mekapele-logo.png" alt="Mekapele" className="h-9 w-auto" />
        <div className="flex-1">
          <h1 className="font-display text-2xl">התבניות שלי</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            כל תבניות הקיפול ששמרת.
          </p>
        </div>
        <button
          onClick={() => setView("config")}
          className="text-sm px-3 py-1.5 rounded-lg border"
          style={{ borderColor: "var(--line)" }}
        >
          תבנית חדשה
        </button>
        <UserBadge />
      </header>

      {!user && !authLoading && (
        <LoginGate message="התחברו כדי לראות ולשמור את התבניות שלכם." />
      )}

      {user && loading && (
        <p className="text-[var(--ink-soft)]">טוען…</p>
      )}

      {user && !loading && error && (
        <p
          className="text-sm rounded-lg px-3 py-2"
          style={{ background: "rgba(226,97,74,0.12)", color: "var(--coral-deep)" }}
        >
          {error}
        </p>
      )}

      {user && !loading && !error && items.length === 0 && (
        <div
          className="rounded-[var(--radius)] p-8 text-center"
          style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
        >
          <p className="font-display text-lg mb-1">עדיין אין תבניות שמורות</p>
          <p className="text-sm text-[var(--ink-soft)] mb-4">
            צרו תבנית חדשה והיא תופיע כאן.
          </p>
          <button
            onClick={() => setView("config")}
            className="px-5 py-2.5 rounded-[var(--radius)] font-semibold text-white"
            style={{ background: "var(--coral)" }}
          >
            ליצירת תבנית
          </button>
        </div>
      )}

      {user && !loading && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((sp) => {
            const total = sp.pattern.pages.length;
            const done = sp.foldedPages.length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <div
                key={sp.id}
                className="rounded-[var(--radius)] p-5 border"
                style={{ borderColor: "var(--line)", background: "var(--paper-2)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg">{sp.name}</h3>
                    <p className="text-xs text-[var(--ink-soft)] tabular">
                      {sp.pattern.config.totalPages} עמודים ·{" "}
                      {sp.pattern.config.mode === "MMF" ? "סימון וקיפול" : "גזירה וקיפול"}{" "}
                      · {new Date(sp.createdAt).toLocaleDateString("he-IL")}
                    </p>
                  </div>
                  <span className="font-display tabular text-xl">{pct}%</span>
                </div>

                <div
                  className="h-2 w-full rounded-full overflow-hidden my-3"
                  style={{ background: "var(--line)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background:
                        pct >= 100 ? "var(--sage)" : "var(--coral)",
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onOpen(sp)}
                    className="flex-1 min-w-[6rem] py-2 rounded-lg font-semibold text-white text-sm"
                    style={{ background: "var(--ink)" }}
                  >
                    מצב סדנה
                  </button>
                  <button
                    onClick={() => exportPatternPdf(sp.pattern, sp.name)}
                    className="flex-1 min-w-[6rem] py-2 rounded-lg font-semibold border text-sm"
                    style={{ borderColor: "var(--line)" }}
                  >
                    ייצוא PDF
                  </button>
                  <button
                    onClick={() => onDelete(sp)}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: "var(--line)", color: "var(--coral-deep)" }}
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
