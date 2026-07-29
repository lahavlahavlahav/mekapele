// =============================================================================
// FIRESTORE — payment transaction records  (Admin SDK, server-only)
// -----------------------------------------------------------------------------
// transactions/{growProcessId}:
//   userId, email, packageId, heartsAdded, amount, status ('completed'),
//   growProcessId, createdAt
//
// create-checkout never touches Firestore — it only talks to Grow and hands
// the browser a payment URL. This module is used exclusively by the webhook,
// which is the sole place a transaction record is created, using Grow's own
// process id AS the document id: writing a doc that already exists is a
// no-op, so a duplicate webhook delivery can never double-credit hearts.
//
// Checkout doesn't require being signed in (guest checkout, identified by
// email — see create-checkout). When userId is empty at payment time, hearts
// go to pendingCredits/{growProcessId} instead of a user doc; ensureUserProfile
// (lib/firestore/projects.ts) claims any pending credits matching the
// signer-in's email the next time they authenticate.
// =============================================================================

import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export interface TransactionRecord {
  userId: string;
  email: string;
  packageId: string;
  heartsAdded: number;
  amount: number;
  status: "completed";
  growProcessId: string;
  createdAt: number;
}

export interface RecordPaymentResult {
  record: TransactionRecord;
  /** True if this call actually granted hearts; false if already recorded (duplicate webhook). */
  granted: boolean;
}

/**
 * Idempotently record a confirmed Grow payment and credit hearts, atomically,
 * keyed by growProcessId. Safe to call multiple times with the same
 * growProcessId — only the first call grants hearts.
 *
 * If userId is set, hearts go straight to that user. If it's empty (guest
 * checkout), hearts are parked in pendingCredits/{growProcessId} keyed by
 * email, to be claimed on next sign-in.
 */
export async function recordCompletedPayment(
  growProcessId: string,
  params: Omit<TransactionRecord, "status" | "createdAt" | "growProcessId">
): Promise<RecordPaymentResult> {
  const db = getAdminDb();
  const ref = db.collection("transactions").doc(growProcessId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return { record: snap.data() as TransactionRecord, granted: false };
    }

    const record: TransactionRecord = {
      ...params,
      status: "completed",
      growProcessId,
      createdAt: Date.now(),
    };

    tx.set(ref, record);

    if (params.userId) {
      tx.update(db.collection("users").doc(params.userId), {
        hearts: FieldValue.increment(params.heartsAdded),
      });
    } else {
      tx.set(db.collection("pendingCredits").doc(growProcessId), {
        email: params.email.toLowerCase(),
        heartsAdded: params.heartsAdded,
        packageId: params.packageId,
        claimed: false,
        createdAt: Date.now(),
      });
    }

    return { record, granted: true };
  });
}
