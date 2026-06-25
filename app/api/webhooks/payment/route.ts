// =============================================================================
// POST /api/webhooks/payment  — payment provider webhook (PLACEHOLDER)
// -----------------------------------------------------------------------------
// This is where Stripe / PayPal notifies us of a successful payment so we can
// grant credits or upgrade a tier. It is the ONLY path (besides admin) that may
// modify protected billing fields.
//
// CRITICAL SECURITY: webhooks are public URLs. NEVER trust the body. Anyone can
// POST here pretending to have paid. You MUST verify the cryptographic
// signature the provider sends in a header, computed over the RAW request body
// using your webhook signing secret (env var, never in client code).
//
// The verification below is written for Stripe's scheme as a concrete example;
// PayPal is analogous (verify against their webhook ID + transmission headers).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { grantCredits } from "@/lib/firestore/projects";

export const runtime = "nodejs";

/**
 * Verify a Stripe-style signature header:
 *   Stripe-Signature: t=<timestamp>,v1=<hmacSHA256(`${t}.${rawBody}`, secret)>
 * Returns true only if a v1 signature matches and the timestamp is recent
 * (guards against replay attacks).
 */
function verifyStripeSignature(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSeconds = 300
): boolean {
  if (!sigHeader) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;

  // Replay protection: reject stale timestamps.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  // Constant-time comparison to avoid timing leaks.
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration — fail closed.
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 500 }
    );
  }

  // Read the RAW body (do NOT JSON.parse before verifying — the signature is
  // over the exact bytes).
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!verifyStripeSignature(rawBody, signature, secret)) {
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 400 }
    );
  }

  // Signature valid — now it's safe to parse and act.
  let event: { type: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  // Example handling. Map your real product/price IDs → credit amounts.
  switch (event.type) {
    case "checkout.session.completed": {
      const obj = event.data?.object ?? {};
      const uid = (obj["client_reference_id"] as string) || "";
      // TODO: look up purchased quantity / price → credits to grant.
      const creditsToGrant = 10;
      if (uid) await grantCredits(uid, creditsToGrant);
      break;
    }
    // case "customer.subscription.updated": update subscriptionTier ...
    default:
      // Ignore unhandled event types.
      break;
  }

  // Always 200 once verified so the provider stops retrying.
  return NextResponse.json({ received: true }, { status: 200 });
}
