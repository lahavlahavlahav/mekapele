// =============================================================================
// FIRESTORE — server-side user & subscription operations  (Admin SDK)
// -----------------------------------------------------------------------------
// Billing is a monthly pass: subscriptions/{uid}.activeUntil (epoch ms). That
// collection sits under firestore.rules' default-deny, so no client can read
// or write it - only the Admin SDK here (and the Grow webhook, via
// lib/firestore/transactions.ts) touches it. The browser learns its status
// from GET /api/subscription.
// =============================================================================

import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";

export interface UserProfile {
  email: string | null;
  createdAt: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The site owner's own account, for demoing/testing the full flow without
 * paying: always treated as subscribed.
 */
export const OWNER_TEST_EMAIL = "lahavbarak430@gmail.com";

/** Ensure a user doc exists, and claim any guest purchases made under this email. */
export async function ensureUserProfile(
  uid: string,
  email: string | null
): Promise<UserProfile> {
  const ref = getAdminDb().collection("users").doc(uid);
  const snap = await ref.get();

  const profile: UserProfile = snap.exists
    ? (snap.data() as UserProfile)
    : { email, createdAt: Date.now() };
  if (!snap.exists) await ref.set(profile);

  if (email && email !== OWNER_TEST_EMAIL) {
    await claimPendingCredits(uid, email);
  }

  return profile;
}

/**
 * New subscription end after adding `days`: counted from the current end if
 * the pass is still running (renewing early never loses days), else from now.
 */
export function extendActiveUntil(currentUntil: number | undefined, days: number): number {
  const base = Math.max(Date.now(), currentUntil ?? 0);
  return base + days * DAY_MS;
}

/**
 * Apply subscription days from any guest purchases (checkout without being
 * signed in, identified by email — see app/api/payment/create-checkout)
 * matching this email. Called on every sign-in via ensureUserProfile, so a
 * guest purchase made before ever creating an account gets picked up the
 * first time they do.
 */
export async function claimPendingCredits(
  uid: string,
  email: string
): Promise<void> {
  const db = getAdminDb();
  const normalized = email.toLowerCase();
  const query = db
    .collection("pendingCredits")
    .where("email", "==", normalized)
    .where("claimed", "==", false);
  const subRef = db.collection("subscriptions").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(query);
    if (snap.empty) return;
    const sub = await tx.get(subRef);

    let days = 0;
    for (const doc of snap.docs) {
      days += Number(doc.data().daysAdded ?? 0);
      tx.update(doc.ref, { claimed: true, claimedByUid: uid, claimedAt: Date.now() });
    }
    if (days > 0) {
      const activeUntil = extendActiveUntil(sub.data()?.activeUntil as number | undefined, days);
      tx.set(subRef, { email: normalized, activeUntil, updatedAt: Date.now() }, { merge: true });
    }
  });
}

/** Epoch ms the user's pass runs until (0 if never subscribed). */
export async function getActiveUntil(uid: string, email: string | null): Promise<number> {
  if (email === OWNER_TEST_EMAIL) return Date.now() + 365 * DAY_MS;
  const snap = await getAdminDb().collection("subscriptions").doc(uid).get();
  return (snap.data()?.activeUntil as number | undefined) ?? 0;
}

/** True if the user may generate patterns right now. */
export async function hasActiveSubscription(uid: string, email: string | null): Promise<boolean> {
  return (await getActiveUntil(uid, email)) > Date.now();
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
