// =============================================================================
// FIRESTORE — payment transaction records  (Admin SDK, server-only)
// -----------------------------------------------------------------------------
// transactions/{growProcessId}:
//   userId, email, planId, daysAdded, amount, status ('completed'),
//   growProcessId, createdAt
//
// create-checkout never touches Firestore — it only talks to Grow and hands
// the browser a payment URL. This module is used exclusively by the webhook,
// which is the sole place a transaction record is created, using Grow's own
// process id AS the document id: writing a doc that already exists is a
// no-op, so a duplicate webhook delivery can never extend a pass twice.
//
// Checkout doesn't require being signed in (guest checkout, identified by
// email — see create-checkout). When userId is empty at payment time, the
// days go to pendingCredits/{growProcessId} instead; ensureUserProfile
// (lib/firestore/projects.ts) claims any pending credits matching the
// signer-in's email the next time they authenticate.
// =============================================================================

import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { extendActiveUntil } from "@/lib/firestore/projects";

export interface TransactionRecord {
  userId: string;
  email: string;
  planId: string;
  daysAdded: number;
  amount: number;
  status: "completed";
  growProcessId: string;
  createdAt: number;
}

export interface RecordPaymentResult {
  record: TransactionRecord;
  /** True if this call actually extended a pass; false if already recorded (duplicate webhook). */
  granted: boolean;
}

/**
 * Idempotently record a confirmed Grow payment and extend the buyer's
 * subscription, atomically, keyed by growProcessId. Safe to call multiple
 * times with the same growProcessId — only the first call grants days.
 *
 * If userId is set, the days go straight to subscriptions/{userId}. If it's
 * empty (guest checkout), they're parked in pendingCredits/{growProcessId}
 * keyed by email, to be claimed on next sign-in.
 */
export async function recordCompletedPayment(
  growProcessId: string,
  params: Omit<TransactionRecord, "status" | "createdAt" | "growProcessId">
): Promise<RecordPaymentResult> {
  const db = getAdminDb();
  const ref = db.collection("transactions").doc(growProcessId);
  const subRef = params.userId ? db.collection("subscriptions").doc(params.userId) : null;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return { record: snap.data() as TransactionRecord, granted: false };
    }
    const sub = subRef ? await tx.get(subRef) : null;

    const record: TransactionRecord = {
      ...params,
      status: "completed",
      growProcessId,
      createdAt: Date.now(),
    };

    tx.set(ref, record);

    if (subRef) {
      const activeUntil = extendActiveUntil(sub?.data()?.activeUntil as number | undefined, params.daysAdded);
      tx.set(
        subRef,
        { email: params.email.toLowerCase(), activeUntil, updatedAt: Date.now() },
        { merge: true }
      );
    } else {
      tx.set(db.collection("pendingCredits").doc(growProcessId), {
        email: params.email.toLowerCase(),
        daysAdded: params.daysAdded,
        planId: params.planId,
        claimed: false,
        createdAt: Date.now(),
      });
    }

    return { record, granted: true };
  });
}
