// =============================================================================
// GROW (formerly Meshulam) PAYMENT API CLIENT  (server-only)
// -----------------------------------------------------------------------------
// Docs: https://developers.grow.business/  (source for the field names below).
//
// ⚠️ NOT LIVE-TESTED. This was written from Grow's public API reference, not
// against a real sandbox account (no Grow credentials were available while
// building this). Before accepting real payments:
//   1. Get pageCode + userId from Grow onboarding, set GROW_PAGE_CODE / GROW_USER_ID.
//   2. Run one real checkout in the SANDBOX host and inspect the actual
//      createPaymentProcess response + webhook payload — confirm the field
//      names read below (paymentUrl/processId location, approveTransaction
//      params) match exactly, AND confirm the request body encoding. Grow's
//      docs describe requests as "HTTP POST, not JSON", suggesting
//      application/x-www-form-urlencoded (used below) rather than a JSON
//      body — verify this against a real request before going live.
//   3. Only then switch GROW_API_BASE to the production host.
// =============================================================================

import "server-only";

const DEFAULT_SANDBOX_BASE =
  "https://sandbox.meshulam.co.il/api/light/server/1.0";

function apiBase(): string {
  return process.env.GROW_API_BASE || DEFAULT_SANDBOX_BASE;
}

function credentials() {
  const pageCode = process.env.GROW_PAGE_CODE;
  const userId = process.env.GROW_USER_ID;
  if (!pageCode || !userId) {
    throw new Error(
      "Missing GROW_PAGE_CODE / GROW_USER_ID env vars — set them from your Grow onboarding."
    );
  }
  return { pageCode, userId };
}

export interface CreatePaymentProcessParams {
  sum: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  /**
   * Grow's generic custom-data slots, echoed back verbatim on the webhook.
   * The webhook handler is the only place these get read back — create-checkout
   * never writes anything to Firestore, so this is the sole channel carrying
   * what to credit once payment is confirmed.
   */
  cField1: string; // our Firebase uid
  cField2: string; // hearts to add, as a string
  cField3: string; // packageId, for the transaction record
  fullName?: string;
  email?: string;
}

export interface CreatePaymentProcessResult {
  paymentUrl: string;
  growProcessId: string;
}

export async function createPaymentProcess(
  params: CreatePaymentProcessParams
): Promise<CreatePaymentProcessResult> {
  const { pageCode, userId } = credentials();

  const form = new URLSearchParams();
  form.set("pageCode", pageCode);
  form.set("userId", userId);
  form.set("sum", String(params.sum));
  form.set("currency", "1"); // ILS — confirm against Grow docs/support if this changes.
  form.set("paymentNum", "1"); // single payment, no installments.
  form.set("successUrl", params.successUrl);
  form.set("cancelUrl", params.cancelUrl);
  form.set("notifyUrl", params.notifyUrl);
  form.set("description", params.description);
  if (params.fullName) form.set("fullName", params.fullName);
  if (params.email) form.set("email", params.email);
  form.set("cField1", params.cField1);
  form.set("cField2", params.cField2);
  form.set("cField3", params.cField3);

  const res = await fetch(`${apiBase()}/createPaymentProcess`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok || json.err !== "0") {
    const message =
      (json.errMsg as string | undefined) ||
      (json.err as string | undefined) ||
      `Grow API error (HTTP ${res.status}).`;
    throw new Error(`Grow createPaymentProcess failed: ${message}`);
  }

  const data = (json.data ?? {}) as Record<string, unknown>;
  const paymentUrl = (data.url as string | undefined) ?? (json.url as string | undefined);
  const growProcessId =
    (data.processId as string | number | undefined) ??
    (data.processToken as string | undefined) ??
    (json.processId as string | number | undefined);

  if (!paymentUrl || growProcessId === undefined) {
    throw new Error(
      "Unexpected Grow createPaymentProcess response shape — check lib/payment/grow.ts against the live API."
    );
  }

  return { paymentUrl, growProcessId: String(growProcessId) };
}

/**
 * Acknowledge receipt of the webhook notification, per Grow's docs. Grow
 * treats the underlying transaction as settled regardless of whether this
 * call succeeds, so failures here are logged but never block crediting the
 * user — call this AFTER hearts have already been granted.
 */
export async function approveTransaction(growProcessId: string): Promise<void> {
  try {
    const { pageCode, userId } = credentials();
    const form = new URLSearchParams();
    form.set("pageCode", pageCode);
    form.set("userId", userId);
    form.set("processId", growProcessId);
    const res = await fetch(`${apiBase()}/approveTransaction`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) {
      console.error(
        `Grow approveTransaction returned HTTP ${res.status} for process ${growProcessId}`
      );
    }
  } catch (err) {
    console.error("Grow approveTransaction call failed:", err);
  }
}
