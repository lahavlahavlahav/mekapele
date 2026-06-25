// =============================================================================
// FIRESTORE — server-side user & credit operations  (Admin SDK)
// -----------------------------------------------------------------------------
// All credit/tier mutations live here and run with the Admin SDK, which is the
// ONLY actor permitted by firestore.rules to touch those protected fields.
// The client can READ its own user doc but can NEVER write credits/tier.
// =============================================================================

import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export interface UserProfile {
  userId: string;
  email: string | null;
  credits: number;
  subscriptionTier: "free" | "pro" | "studio";
  createdAt: number;
}

/** Ensure a user doc exists; create with starter credits on first login. */
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
    userId: uid,
    email,
    credits: 3, // free starter credits — generous enough to try, gated after
    subscriptionTier: "free",
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
 * Atomically consume `amount` credits if available. Returns the new balance,
 * or null if the user lacks sufficient credits. Runs in a transaction so two
 * concurrent requests can't double-spend.
 */
export async function consumeCredits(
  uid: string,
  amount = 1
): Promise<number | null> {
  const ref = getAdminDb().collection("users").doc(uid);
  return getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const profile = snap.data() as UserProfile;

    // Paid tiers are unmetered here; adjust to your billing model.
    if (profile.subscriptionTier !== "free") {
      return profile.credits;
    }
    if (profile.credits < amount) return null;

    const next = profile.credits - amount;
    tx.update(ref, { credits: next });
    return next;
  });
}

/** Grant credits (called by payment webhook only). */
export async function grantCredits(
  uid: string,
  amount: number
): Promise<void> {
  await getAdminDb()
    .collection("users")
    .doc(uid)
    .update({ credits: FieldValue.increment(amount) });
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
