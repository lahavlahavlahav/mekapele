// =============================================================================
// FIRESTORE — payment transaction records  (Admin SDK, server-only)
// -----------------------------------------------------------------------------
// transactions/{transactionId}:
//   userId, packageId, heartsAdded, amount, status ('pending'|'completed'),
//   growProcessId, createdAt
//
// Created (status: 'pending') when a checkout link is generated, then flipped
// to 'completed' by the Grow webhook once payment is confirmed. Clients never
// read/write this collection directly — see firestore.rules.
// =============================================================================

import "server-only";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export type TransactionStatus = "pending" | "completed";

export interface TransactionRecord {
  userId: string;
  packageId: string;
  heartsAdded: number;
  amount: number;
  status: TransactionStatus;
  growProcessId: string;
  createdAt: number;
}

/** Create a pending transaction right after Grow issues a payment process id. */
export async function createTransaction(
  params: Omit<TransactionRecord, "status" | "createdAt">
): Promise<string> {
  const ref = await getAdminDb()
    .collection("transactions")
    .add({
      ...params,
      status: "pending" satisfies TransactionStatus,
      createdAt: Date.now(),
    });
  return ref.id;
}

export interface CompleteTransactionResult {
  record: TransactionRecord;
  /** True if this call actually granted hearts; false if already processed (duplicate webhook). */
  granted: boolean;
}

/**
 * Atomically: find the pending transaction for this Grow process id, flip it
 * to 'completed', and credit the user's hearts — all in one Firestore
 * transaction so a duplicate webhook delivery can never double-credit.
 * Returns null if no transaction with this growProcessId exists at all.
 */
export async function completeTransactionByGrowProcessId(
  growProcessId: string
): Promise<CompleteTransactionResult | null> {
  const db = getAdminDb();

  return db.runTransaction(async (tx) => {
    const query = db
      .collection("transactions")
      .where("growProcessId", "==", growProcessId)
      .limit(1);
    const snap = await tx.get(query);
    if (snap.empty) return null;

    const doc = snap.docs[0];
    const data = doc.data() as TransactionRecord;

    if (data.status === "completed") {
      return { record: data, granted: false }; // duplicate delivery — idempotent no-op
    }

    tx.update(doc.ref, { status: "completed" satisfies TransactionStatus });
    tx.update(db.collection("users").doc(data.userId), {
      hearts: FieldValue.increment(data.heartsAdded),
    });

    return { record: data, granted: true };
  });
}
