// =============================================================================
// FIRESTORE — payment transaction records  (Admin SDK, server-only)
// -----------------------------------------------------------------------------
// transactions/{stripeSessionId}:
//   userId, packageId, heartsAdded, amount, status ('completed'),
//   stripeSessionId, createdAt
//
// create-checkout never touches Firestore — it only talks to Stripe and hands
// the browser a Checkout Session URL. This module is used exclusively by the
// webhook, which is the sole place a transaction record is created, using
// Stripe's own Checkout Session id AS the document id: writing a doc that
// already exists is a no-op, so a duplicate webhook delivery (Stripe retries
// on anything but a 2xx response) can never double-credit hearts.
// =============================================================================

import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export interface TransactionRecord {
  userId: string;
  packageId: string;
  heartsAdded: number;
  amount: number;
  status: "completed";
  stripeSessionId: string;
  createdAt: number;
}

export interface RecordPaymentResult {
  record: TransactionRecord;
  /** True if this call actually granted hearts; false if already recorded (duplicate webhook). */
  granted: boolean;
}

/**
 * Idempotently record a confirmed Stripe payment and credit the user's
 * hearts, atomically, keyed by the Checkout Session id. Safe to call multiple
 * times with the same stripeSessionId — only the first call grants hearts.
 */
export async function recordCompletedPayment(
  stripeSessionId: string,
  params: Omit<TransactionRecord, "status" | "createdAt" | "stripeSessionId">
): Promise<RecordPaymentResult> {
  const db = getAdminDb();
  const ref = db.collection("transactions").doc(stripeSessionId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      return { record: snap.data() as TransactionRecord, granted: false };
    }

    const record: TransactionRecord = {
      ...params,
      status: "completed",
      stripeSessionId,
      createdAt: Date.now(),
    };

    tx.set(ref, record);
    tx.update(db.collection("users").doc(params.userId), {
      hearts: FieldValue.increment(params.heartsAdded),
    });

    return { record, granted: true };
  });
}
