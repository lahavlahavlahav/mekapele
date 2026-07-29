// =============================================================================
// MAKE.COM PAYMENT LINK CLIENT  (server-only)
// -----------------------------------------------------------------------------
// Grow's direct API (createPaymentProcess) costs 500 ILS+VAT/month. Grow's own
// support suggested creating one-time custom payment pages via their Make.com
// app instead, at no extra cost. This module calls a Make.com "Custom
// webhook" scenario that YOU build — it is the contract our server expects
// that scenario to satisfy, not a Grow API client.
//
// ⚠️ SETUP REQUIRED — build a Make.com scenario (see SAAS_SETUP.md) with:
//   1. Trigger: "Custom webhook" — copy its URL into MAKE_CHECKOUT_WEBHOOK_URL.
//   2. Action: Grow's "Create Payment Link" module. Grow requires Full Name +
//      Phone (both real, collected in the purchase modal — not placeholders),
//      map them from this webhook's `fullName`/`phone` fields, and map
//      `email` too (optional on Grow's side). Set Grow's custom fields
//      (cField1/cField2/cField3) to userId/heartsAdded/packageId if the Grow
//      module in Make exposes them (it should — check when building this;
//      tell Claude if it doesn't, the webhook needs another way to identify
//      the purchase).
//   3. Module: "Webhook response" — respond with JSON: { "paymentUrl": <the
//      page's URL> }. That's the only contract this file relies on.
//
// Payment CONFIRMATION does NOT go through Make: Grow's account-level
// Webhooks feature (Dashboard -> Webhooks, the one already configured with a
// webhookKey) calls app/api/webhooks/grow directly — that path doesn't
// require the paid API, only creating dynamic links did.
// =============================================================================

import "server-only";

export interface CreatePaymentLinkParams {
  sum: number;
  description: string;
  userId: string;
  heartsAdded: string;
  packageId: string;
  successUrl: string;
  cancelUrl: string;
  /** Real customer contact info — Grow requires both to create a payment page. */
  fullName: string;
  phone: string;
  email?: string;
}

export interface CreatePaymentLinkResult {
  paymentUrl: string;
}

export async function createPaymentLink(
  params: CreatePaymentLinkParams
): Promise<CreatePaymentLinkResult> {
  const webhookUrl = process.env.MAKE_CHECKOUT_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("Missing MAKE_CHECKOUT_WEBHOOK_URL env var.");
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(`Make webhook returned HTTP ${res.status}: ${JSON.stringify(json)}`);
  }

  const paymentUrl = json.paymentUrl as string | undefined;
  if (!paymentUrl) {
    throw new Error(
      "Make webhook response is missing paymentUrl — check the scenario's Webhook response module."
    );
  }

  return { paymentUrl };
}
