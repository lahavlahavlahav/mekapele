// =============================================================================
// POST /api/webhooks/grow  — Grow (Meshulam) payment notification
// -----------------------------------------------------------------------------
// Single responsibility: receive Grow's payment notification, and — once and
// only once per growProcessId — update Firestore (credit hearts, record the
// transaction). create-checkout never writes to Firestore (it asks a
// Make.com scenario to create the payment page — see lib/payment/make.ts),
// so everything the user bought comes from THIS payload's customFields
// (cField1 = userId, cField2 = heartsToAdd, cField3 = packageId) — assuming
// the Make scenario set those custom fields when creating the page (check
// this when you build it; without them this webhook can't tell who paid).
//
// This is called DIRECTLY by Grow (account-level Webhooks feature, not
// routed through Make) — that path doesn't require the paid API, only
// dynamically creating payment links did.
//
// Authenticity: this URL is public, so anyone could POST here. Grow's
// dashboard-configured webhook includes a `webhookKey` field in the body —
// we reject anything that doesn't match GROW_WEBHOOK_KEY (fail closed if
// that env var isn't set at all).
//
// Idempotency: recordCompletedPayment (lib/firestore/transactions.ts) uses
// growProcessId as the Firestore document id inside a transaction, so a
// duplicate delivery of the same event is a guaranteed no-op — it can never
// credit hearts twice.
//
// ⚠️ Not live-tested against a real Grow account. Confirm the payload shape
// (JSON vs form-encoded, exact field names/nesting, and whether customFields
// actually come through when the page was created via Make rather than the
// direct API) against a real sandbox delivery before going live.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { recordCompletedPayment } from "@/lib/firestore/transactions";

export const runtime = "nodejs";

/** Grow's callback body, tolerant of both JSON and form-encoded delivery. */
async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return req.json().catch(() => ({}));
  }
  const text = await req.text();
  try {
    return JSON.parse(text);
  } catch {
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }
}

/** Constant-time string compare so a mismatched key can't be timed/guessed. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const expectedKey = process.env.GROW_WEBHOOK_KEY;
  if (!expectedKey) {
    // Misconfiguration — fail closed rather than accept unverified payloads.
    console.error("Grow webhook: GROW_WEBHOOK_KEY is not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const body = await parseBody(req);

  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  const receivedKey = String(body.webhookKey ?? data.webhookKey ?? "");
  if (!receivedKey || !safeEqual(receivedKey, expectedKey)) {
    console.error("Grow webhook: invalid or missing webhookKey.");
    return NextResponse.json({ error: "Invalid webhook key." }, { status: 401 });
  }

  const err = (body.err ?? data.err) as string | undefined;

  if (err !== "0") {
    // Not a successful payment — acknowledge without touching Firestore.
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const growProcessId = String(data.processId ?? data.processToken ?? "");
  const customFields =
    (data.customFields as Record<string, unknown> | undefined) ?? {};
  const userId = String(customFields.cField1 ?? "");
  const heartsAdded = Number(customFields.cField2 ?? 0);
  const packageId = String(customFields.cField3 ?? "");
  const amount = Number(data.sum ?? 0);

  if (!growProcessId || !userId || !Number.isFinite(heartsAdded) || heartsAdded <= 0) {
    console.error("Grow webhook: malformed payload", { growProcessId, userId, heartsAdded });
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  const { record, granted } = await recordCompletedPayment(growProcessId, {
    userId,
    packageId,
    heartsAdded,
    amount,
  });

  if (granted) {
    console.log(
      `Grow webhook: credited ${record.heartsAdded} hearts to ${record.userId} (process ${growProcessId})`
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
