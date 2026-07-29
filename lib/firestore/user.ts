// =============================================================================
// FIRESTORE — client-side user profile watcher
// -----------------------------------------------------------------------------
// Read-only subscription to users/{uid} so the header's hearts balance stays
// live (updates instantly after a purchase completes or a pattern is
// generated) without a manual refetch. Writes to `hearts` are rejected by
// firestore.rules for every client — only the Admin SDK can change it.
// =============================================================================

"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { getDbClient } from "@/lib/firebase/client";

export interface ClientUserProfile {
  email: string | null;
  hearts: number;
}

/** Subscribe to a user's profile; fires immediately with cached/null then live updates. */
export function watchUserProfile(
  uid: string,
  cb: (profile: ClientUserProfile | null) => void
) {
  return onSnapshot(
    doc(getDbClient(), "users", uid),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const data = snap.data() as { email?: string | null; hearts?: number };
      cb({ email: data.email ?? null, hearts: data.hearts ?? 0 });
    },
    () => cb(null)
  );
}
