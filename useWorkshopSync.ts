/**
 * useWorkshopSync.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Bi-directional sync between the Zustand `completedPages` state and the
 * Firestore project document at users/{uid}/projects/{projectId}.
 *
 * Strategy:
 *   • On mount, subscribe to the Firestore doc (onSnapshot). When remote data
 *     arrives, push it into the local Zustand store.
 *   • When the user toggles a page (via the store), the component calls
 *     `persistToggle(page)` which writes the new set back to Firestore.
 *
 * Why not write inside the store action?
 *   Stores should be side-effect–free. Auth + Firestore belong in a hook so
 *   we can mock them in tests and the store stays pure.
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useDualViewStore } from "@/lib/dualViewStore";

// ── Firestore app initialisation (lazy singleton) ────────────────────────────

let _db: ReturnType<typeof getFirestore> | null = null;
function getDb() {
  if (!_db) {
    // Firebase app must already be initialised by the time this runs
    // (done in the root layout or a top-level provider).
    _db = getFirestore();
  }
  return _db;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useWorkshopSync() {
  const projectId = useDualViewStore((s) => s.projectId);
  const setCompletedPages = useDualViewStore((s) => s.setCompletedPages);
  const isSyncing = useRef(false);

  // Subscribe to remote changes
  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid || !projectId) return;

    const db = getDb();
    const ref = doc(db, "users", uid, "projects", projectId);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const pages: number[] = data.completedPages ?? [];
        setCompletedPages(pages);
      }
    });

    return unsub;
  }, [projectId, setCompletedPages]);

  /**
   * Call this whenever the user taps "Mark as Completed" on a page.
   * It optimistically updates Zustand (via `togglePage`) then writes to
   * Firestore. If Firestore fails the snapshot listener will revert local
   * state automatically.
   */
  const persistToggle = useCallback(
    async (page: number, isCurrentlyDone: boolean) => {
      const uid = getAuth().currentUser?.uid;
      if (!uid || !projectId || isSyncing.current) return;

      isSyncing.current = true;
      try {
        const db = getDb();
        const ref = doc(db, "users", uid, "projects", projectId);

        // Use arrayUnion/arrayRemove for atomic, conflict-free updates.
        await updateDoc(ref, {
          completedPages: isCurrentlyDone
            ? arrayRemove(page)
            : arrayUnion(page),
          updatedAt: serverTimestamp(),
        }).catch(async () => {
          // Doc may not exist yet — create it with setDoc (merge).
          await setDoc(
            ref,
            {
              completedPages: isCurrentlyDone ? [] : [page],
              userId: uid,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        });
      } finally {
        isSyncing.current = false;
      }
    },
    [projectId]
  );

  return { persistToggle };
}
