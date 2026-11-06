// =============================================================================
// POST /api/webhooks/grow  — Grow (Meshulam) payment notification
// -----------------------------------------------------------------------------
// Single responsibility: receive Grow's payment notification, and — once and
// only once per growProcessId — update Firestore (extend the buyer's monthly
// subscription, record the transaction). create-checkout never writes to Firestore (it asks a
// Make.com scenario to create the payment page — see lib/payment/make.ts),
// so everything the user bought comes from THIS payload's customFields
// (cField1 = userId, cField2 = days bought, cField3 = plan id) — assuming
// the Make scenario set those custom fields when creating the page (check
// this when you build it; without them this webhook can't tell who paid).
//
// Checkout doesn't require being signed in — cField1 (userId) is empty for a
// guest purchase, so we fall back to the buyer's email (a standard field
// Grow returns, not a custom one) and park the days in pendingCredits,
// claimed automatically the next time someone signs in with that email
// (see claimPendingCredits in lib/firestore/projects.ts).
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
// extend a subscription twice.
//
// ⚠️ Not live-tested against a real Grow account. Confirm the payload shape
// (JSON vs form-encoded, exact field names/nesting, whether customFields
// actually come through when the page was created via Make rather than the
// direct API, and the exact key Grow uses for the buyer's email) against a
// real sandbox delivery before going live.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { recordCompletedPayment } from "@/lib/firestore/transactions";
import { getAdminDb } from "@/lib/firebase/admin";
import { GROW_MONTHLY_MARKERS, MONTHLY_PLAN } from "@/lib/pricing";

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

/**
 * Keep every delivery (minus the key) in growWebhookLog, shown on /admin -
 * the only way to see what Grow actually sends without server-log access.
 */
async function logDelivery(body: Record<string, unknown>, keyOk: boolean, outcome: string) {
  const strip = (o: unknown): unknown =>
    o && typeof o === "object" && !Array.isArray(o)
      ? Object.fromEntries(
          Object.entries(o as Record<string, unknown>)
            .filter(([k]) => k !== "webhookKey")
            .map(([k, v]) => [k, strip(v)])
        )
      : o;
  try {
    await getAdminDb()
      .collection("growWebhookLog")
      .add({ receivedAt: Date.now(), keyOk, outcome, payload: JSON.stringify(strip(body)).slice(0, 8000) });
  } catch (err) {
    console.error("Grow webhook: could not log delivery", err);
  }
}

export async function POST(req: NextRequest) {
  const expectedKey = process.env.GROW_WEBHOOK_KEY;
  if (!expectedKey) {
    // Misconfiguration — fail closed rather than accept unverified payloads.
    console.error("Grow webhook: GROW_WEBHOOK_KEY is not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const body = await parseBody(req);
  // The payload shape has never been confirmed against a real Grow delivery
  // (see the file-level comment) — log it in full every time so a delivery
  // that silently falls through one of the branches below (wrong field
  // names, unexpected "err" value, etc.) still leaves a trace in Vercel
  // logs instead of vanishing as a plain 200.
  console.log("Grow webhook: raw payload", JSON.stringify(body));

  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  const receivedKey = String(body.webhookKey ?? data.webhookKey ?? "");
  if (!receivedKey || !safeEqual(receivedKey, expectedKey)) {
    console.error("Grow webhook: invalid or missing webhookKey.");
    await logDelivery(body, false, "נדחה - מפתח שגוי");
    return NextResponse.json({ error: "Invalid webhook key." }, { status: 401 });
  }

  // The old API callback carries err ("0" = success); the dashboard webhook
  // ("עדכון לאחר ביצוע עסקה") only fires for completed transactions and may
  // not include err at all - so only an explicit non-zero err is a failure.
  const err = (body.err ?? data.err) as string | number | undefined;

  if (err !== undefined && String(err) !== "0") {
    // Not a successful payment — acknowledge without touching Firestore.
    console.log(`Grow webhook: acknowledged without crediting (err=${JSON.stringify(err)})`);
    await logDelivery(body, true, `לא תשלום מוצלח (err=${String(err)})`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const growProcessId = String(
    data.processId ??
      data.processToken ??
      data.transactionId ??
      data.transactionCode ??
      data.asmachta ??
      ""
  );
  const customFields =
    (data.customFields as Record<string, unknown> | undefined) ?? {};
  const userId = String(customFields.cField1 ?? "");
  const fromMakePage = String(customFields.cField3 ?? "") === MONTHLY_PLAN.id;
  // The fixed Grow page (GROW_MONTHLY_PAYMENT_URL) has no custom fields.
  // This webhook fires for every payment on the Grow account, so a payment
  // only counts when its payload names that page's product or page id.
  const rawPayload = JSON.stringify(body);
  const fromFixedPage = GROW_MONTHLY_MARKERS.some((m) => rawPayload.includes(m));
  if (!fromMakePage && !fromFixedPage) {
    console.log("Grow webhook: not a Mekapele subscription payment - ignored.");
    await logDelivery(body, true, "לא מנוי מקפלא - התעלמות");
    return NextResponse.json({ received: true }, { status: 200 });
  }
  const planId = MONTHLY_PLAN.id;
  const daysAdded = fromMakePage ? Number(customFields.cField2 ?? 0) : MONTHLY_PLAN.days;
  const amount = Number(data.sum ?? data.paymentSum ?? 0);
  // No userId (guest checkout, or the fixed page) — fall back to the buyer's
  // email so the days are parked in pendingCredits and claimed on the next
  // /api/subscription call from an account with that email.
  const email = String(data.payerEmail ?? data.email ?? data.customerEmail ?? "")
    .trim()
    .toLowerCase();

  if (
    !growProcessId ||
    (!userId && !email) ||
    !Number.isFinite(daysAdded) ||
    daysAdded <= 0
  ) {
    console.error("Grow webhook: malformed payload", { growProcessId, userId, email, daysAdded });
    await logDelivery(body, true, "חסר מזהה תהליך או אימייל");
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  const { record, granted } = await recordCompletedPayment(growProcessId, {
    userId,
    email,
    planId,
    daysAdded,
    amount,
  });

  await logDelivery(body, true, granted ? `זוכה: ${email || userId}` : "כפילות - כבר זוכה");

  if (granted) {
    console.log(
      `Grow webhook: added ${record.daysAdded} subscription days to ${record.userId || `pending:${record.email}`} (process ${growProcessId})`
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
