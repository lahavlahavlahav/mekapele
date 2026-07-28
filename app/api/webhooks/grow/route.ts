// =============================================================================
// POST /api/webhooks/grow  — Grow (Meshulam) payment notification
// -----------------------------------------------------------------------------
// Grow calls this URL (the `notifyUrl` we passed to createPaymentProcess) once
// a payment finishes. This is a public URL — anyone can POST here, so we never
// credit hearts from the raw payload alone. The payload's `cField1`/`cField2`
// are only used for logging/cross-checks; the actual credit amount + owning
// user come from OUR OWN pending transaction record (looked up by the Grow
// process id), which only we could have created in create-checkout.
//
// ⚠️ Same caveat as lib/payment/grow.ts: not live-tested against a real Grow
// account. Confirm the payload shape (JSON vs form-encoded, exact field
// names/nesting) against a real sandbox delivery before going live.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { completeTransactionByGrowProcessId } from "@/lib/firestore/transactions";
import { approveTransaction } from "@/lib/payment/grow";

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

export async function POST(req: NextRequest) {
  const body = await parseBody(req);

  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  const err = (body.err ?? data.err) as string | undefined;

  if (err !== "0") {
    // Not a successful payment — acknowledge without granting anything.
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const growProcessId = String(data.processId ?? data.processToken ?? "");
  if (!growProcessId) {
    return NextResponse.json(
      { error: "Missing process id in webhook payload." },
      { status: 400 }
    );
  }

  // For logging/cross-check only — the authoritative amounts come from our
  // own transaction record below, keyed by growProcessId.
  const customFields =
    (data.customFields as Record<string, unknown> | undefined) ?? {};
  const claimedUserId = customFields.cField1;
  const claimedHearts = customFields.cField2;

  const result = await completeTransactionByGrowProcessId(growProcessId);
  if (!result) {
    console.error(
      `Grow webhook: no transaction found for process ${growProcessId} (claimed user=${claimedUserId} hearts=${claimedHearts})`
    );
    return NextResponse.json(
      { error: "Unknown transaction." },
      { status: 404 }
    );
  }

  if (result.granted) {
    console.log(
      `Grow webhook: credited ${result.record.heartsAdded} hearts to ${result.record.userId} (process ${growProcessId})`
    );
  }

  // Best-effort acknowledgment call to Grow; never blocks the response since
  // hearts are already granted regardless of this call's outcome.
  await approveTransaction(growProcessId);

  return NextResponse.json({ received: true }, { status: 200 });
}
