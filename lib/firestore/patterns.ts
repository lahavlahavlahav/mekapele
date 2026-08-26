// =============================================================================
// FIRESTORE — client-side pattern storage  (My Patterns)
// -----------------------------------------------------------------------------
// Reads/writes the logged-in user's saved patterns under
//   users/{userId}/patterns/{patternId}
// All access is guarded by firestore.rules (request.auth.uid == userId), so a
// user can only ever touch their own documents. This is the browser-facing
// counterpart to the Admin-side helpers in projects.ts.
// =============================================================================

"use client";

import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getDbClient } from "@/lib/firebase/client";
import type { FoldingPattern } from "@/lib/types";

export interface SavedPattern {
  id: string;
  name: string;
  pattern: FoldingPattern;
  createdAt: number;
  // Tracker progress persisted alongside the pattern.
  currentPage: number;
  foldedPages: number[];
  /** Small reference-image data URL (see makeThumbnail) - without it, a
   * pattern reopened from the cloud has no image to overlay in the tracker's
   * visual preview, just the blank column striping. Firestore's 1MiB
   * per-document limit is why this is the small thumbnail, not the
   * algorithm's own higher-resolution working image. */
  thumbnail: string | null;
}

interface PatternDoc {
  name: string;
  pattern: FoldingPattern;
  createdAt: Timestamp | null;
  currentPage: number;
  foldedPages: number[];
  userId: string;
  thumbnail: string | null;
}

function patternsCol(uid: string) {
  return collection(getDbClient(), "users", uid, "patterns");
}

/** Save a new pattern for the user. Returns the new document id. */
export async function savePattern(
  uid: string,
  name: string,
  pattern: FoldingPattern,
  thumbnail: string | null
): Promise<string> {
  const ref = await addDoc(patternsCol(uid), {
    name,
    pattern,
    createdAt: serverTimestamp(),
    currentPage: 1,
    foldedPages: [],
    userId: uid,
    thumbnail,
  } satisfies Omit<PatternDoc, "createdAt"> & { createdAt: unknown });
  return ref.id;
}

/** Fetch all saved patterns for the user, newest first. */
export async function listPatterns(uid: string): Promise<SavedPattern[]> {
  const q = query(patternsCol(uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as PatternDoc;
    return {
      id: d.id,
      name: data.name,
      pattern: data.pattern,
      createdAt: data.createdAt ? data.createdAt.toMillis() : Date.now(),
      currentPage: data.currentPage ?? 1,
      foldedPages: data.foldedPages ?? [],
      thumbnail: data.thumbnail ?? null,
    };
  });
}

/** Delete one saved pattern. */
export async function deletePattern(
  uid: string,
  patternId: string
): Promise<void> {
  await deleteDoc(doc(getDbClient(), "users", uid, "patterns", patternId));
}

/** Persist tracker progress (current page + folded set) for a pattern. */
export async function saveProgress(
  uid: string,
  patternId: string,
  currentPage: number,
  foldedPages: number[]
): Promise<void> {
  const { updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(getDbClient(), "users", uid, "patterns", patternId), {
    currentPage,
    foldedPages,
  });
}
