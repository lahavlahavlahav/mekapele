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

/**
 * The site owner's own account for demoing/testing the full flow without
 * spending real money: always has 10 hearts, auto-refilled on every
 * generation (see consumeHearts).
 */
const OWNER_TEST_EMAIL = "lahavbarak430@gmail.com";
const OWNER_TEST_HEARTS = 10;

/** Ensure a user doc exists; new users start with 0 hearts (10 for the owner test account). */
export async function ensureUserProfile(
  uid: string,
  email: string | null
): Promise<UserProfile> {
  const ref = getAdminDb().collection("users").doc(uid);
  const snap = await ref.get();

  const profile: UserProfile = snap.exists
    ? (snap.data() as UserProfile)
    : {
        email,
        hearts: email === OWNER_TEST_EMAIL ? OWNER_TEST_HEARTS : 0,
        createdAt: Date.now(),
      };
  if (!snap.exists) await ref.set(profile);

  if (email && email !== OWNER_TEST_EMAIL) {
    await claimPendingCredits(uid, email);
  }

  return profile;
}

/**
 * Credit hearts from any guest purchases (checkout without being signed in,
 * identified by email — see app/api/payment/create-checkout) matching this
 * email. Called on every sign-in via ensureUserProfile, so a guest purchase
 * made before ever creating an account gets picked up the first time they do.
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

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(query);
    if (snap.empty) return;

    let total = 0;
    for (const doc of snap.docs) {
      total += doc.data().heartsAdded as number;
      tx.update(doc.ref, { claimed: true, claimedByUid: uid, claimedAt: Date.now() });
    }
    if (total > 0) {
      tx.update(db.collection("users").doc(uid), {
        hearts: FieldValue.increment(total),
      });
    }
  });
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

    // Owner test account: never runs out, always sits at 10.
    if (profile.email === OWNER_TEST_EMAIL) {
      if (profile.hearts !== OWNER_TEST_HEARTS) {
        tx.update(ref, { hearts: OWNER_TEST_HEARTS });
      }
      return OWNER_TEST_HEARTS;
    }

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
