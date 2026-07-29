// =============================================================================
// FIRESTORE — server-side user & hearts operations  (Admin SDK)
// -----------------------------------------------------------------------------
// All hearts mutations live here and run with the Admin SDK, which is the
// ONLY actor permitted by firestore.rules to touch that protected field.
// The client can READ its own user doc but can NEVER write `hearts`.
// =============================================================================

import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export interface UserProfile {
  email: string | null;
  hearts: number;
  createdAt: number;
}

/** Ensure a user doc exists; new users start with 0 hearts. */
export async function ensureUserProfile(
  uid: string,
  email: string | null
): Promise<UserProfile> {
  const ref = getAdminDb().collection("users").doc(uid);
  const snap = await ref.get();

  if (snap.exists) {
    return snap.data() as UserProfile;
  }

  const profile: UserProfile = {
    email,
    hearts: 0,
    createdAt: Date.now(),
  };
  await ref.set(profile);
  return profile;
}

/** Read a user profile (server context). */
export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  const snap = await getAdminDb().collection("users").doc(uid).get();
  return snap.exists ? (snap.data() as UserProfile) : null;
}

/**
 * Atomically consume `amount` hearts if available. Returns the new balance,
 * or null if the user lacks sufficient hearts. Runs in a transaction so two
 * concurrent requests can't double-spend.
 */
export async function consumeHearts(
  uid: string,
  amount: number
): Promise<number | null> {
  const ref = getAdminDb().collection("users").doc(uid);
  return getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const profile = snap.data() as UserProfile;

    if (profile.hearts < amount) return null;

    const next = profile.hearts - amount;
    tx.update(ref, { hearts: next });
    return next;
  });
}

/** Grant hearts (called by the Grow payment webhook, or to refund a failed generation). */
export async function grantHearts(uid: string, amount: number): Promise<void> {
  await getAdminDb()
    .collection("users")
    .doc(uid)
    .update({ hearts: FieldValue.increment(amount) });
}

/** Save a generated pattern under the user's projects subcollection. */
export async function saveProject(
  uid: string,
  project: { name: string; pattern: unknown; updatedAt: number }
): Promise<string> {
  const ref = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("projects")
    .add({ ...project, userId: uid });
  return ref.id;
}
