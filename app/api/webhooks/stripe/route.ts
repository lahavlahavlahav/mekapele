// =============================================================================
// POST /api/webhooks/stripe  — Stripe Checkout payment notification
// -----------------------------------------------------------------------------
// Single responsibility: receive Stripe's event, verify its signature, and —
// once and only once per Checkout Session — update Firestore (credit hearts,
// record the transaction). create-checkout never writes to Firestore, so
// everything the user bought comes from session.metadata (userId, packageId,
// heartsAdded), which is exactly what we set when creating the session.
//
// Authenticity: verifyWebhookSignature (lib/payment/stripe.ts) uses Stripe's
// official SDK to check the `Stripe-Signature` header against the RAW
// request body — this rejects anything not actually sent by Stripe.
//
// Idempotency: recordCompletedPayment (lib/firestore/transactions.ts) uses
// the Checkout Session id as the Firestore document id inside a transaction,
// so Stripe's automatic webhook retries can never double-credit hearts.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payment/stripe";
import { recordCompletedPayment } from "@/lib/firestore/transactions";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error("Stripe webhook: signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    // Not a payment we act on — acknowledge without touching Firestore.
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const session = event.data.object as {
    id: string;
    amount_total: number | null;
    metadata: Record<string, string> | null;
  };

  const userId = session.metadata?.userId ?? "";
  const packageId = session.metadata?.packageId ?? "";
  const heartsAdded = Number(session.metadata?.heartsAdded ?? 0);
  const amount = (session.amount_total ?? 0) / 100; // agorot -> ILS

  if (!session.id || !userId || !Number.isFinite(heartsAdded) || heartsAdded <= 0) {
    console.error("Stripe webhook: malformed session", { id: session.id, userId, heartsAdded });
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  const { record, granted } = await recordCompletedPayment(session.id, {
    userId,
    packageId,
    heartsAdded,
    amount,
  });

  if (granted) {
    console.log(
      `Stripe webhook: credited ${record.heartsAdded} hearts to ${record.userId} (session ${session.id})`
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
