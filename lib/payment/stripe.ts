// =============================================================================
// STRIPE PAYMENT CLIENT  (server-only)
// -----------------------------------------------------------------------------
// Uses Stripe Checkout in one-off "payment" mode — no need to pre-create
// Products/Prices in the Stripe dashboard, the price is built inline
// (price_data) from the heart package. Docs: https://docs.stripe.com/checkout
// =============================================================================

import "server-only";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY env var.");
  }
  _stripe = new Stripe(key);
  return _stripe;
}

export interface CreateCheckoutSessionParams {
  amountIls: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  email?: string;
  /** Carried through to the webhook verbatim via session.metadata. */
  metadata: {
    userId: string;
    packageId: string;
    heartsAdded: string;
  };
}

export interface CreateCheckoutSessionResult {
  paymentUrl: string;
  sessionId: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CreateCheckoutSessionResult> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "ils",
          product_data: { name: params.description },
          unit_amount: Math.round(params.amountIls * 100), // agorot
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.email,
    metadata: params.metadata,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return { paymentUrl: session.url, sessionId: session.id };
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET env var.");
  }
  if (!signatureHeader) {
    throw new Error("Missing Stripe-Signature header.");
  }
  return getStripe().webhooks.constructEvent(rawBody, signatureHeader, secret);
}
