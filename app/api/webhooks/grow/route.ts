// =============================================================================
// POST /api/webhooks/grow  — Grow (Meshulam) payment notification
// -----------------------------------------------------------------------------
// Single responsibility: receive Grow's payment notification, and — once and
// only once per growProcessId — update Firestore (credit hearts, record the
// transaction). create-checkout never writes to Firestore, so everything the
// user bought comes from THIS payload's customFields (cField1 = userId,
// cField2 = heartsToAdd, cField3 = packageId), which are simply what we
// handed Grow when starting the payment and Grow echoes back verbatim.
//
// Idempotency: recordCompletedPayment (lib/firestore/transactions.ts) uses
// growProcessId as the Firestore document id inside a transaction, so a
// duplicate delivery of the same event is a guaranteed no-op — it can never
// credit hearts twice.
//
// ⚠️ Not live-tested against a real Grow account (no credentials were
// available while building this). Confirm the payload shape (JSON vs
// form-encoded, exact field names/nesting) against a real sandbox delivery
// before going live — see lib/payment/grow.ts and SAAS_SETUP.md.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { recordCompletedPayment } from "@/lib/firestore/transactions";
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

  // Best-effort acknowledgment call to Grow; never blocks the response since
  // hearts are already granted regardless of this call's outcome.
  await approveTransaction(growProcessId);

  return NextResponse.json({ received: true }, { status: 200 });
}
