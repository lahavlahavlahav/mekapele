// =============================================================================
// PRICING — monthly subscription (Grow checkout via Make.com) + discount codes
// -----------------------------------------------------------------------------
// Pure data/logic, safe to import from both client and server code.
// =============================================================================

/**
 * The one plan: a monthly pass. Paying once unlocks unlimited pattern
 * generation for `days` days from payment (or from the end of the current
 * pass, if still active - renewing early never loses days).
 */
export interface Plan {
  id: "monthly";
  label: string;
  priceIls: number;
  days: number;
}

export const MONTHLY_PLAN: Plan = {
  id: "monthly",
  label: "מנוי חודשי",
  priceIls: 50,
  days: 30,
};

export function getPlan(planId: string): Plan | null {
  return planId === MONTHLY_PLAN.id ? MONTHLY_PLAN : null;
}

/**
 * Discount codes for the subscription checkout. Validated here on both the
 * client (for a live price preview in the purchase modal) and the server
 * (create-checkout route computes the charged amount itself — the client's
 * discounted price is never trusted for billing).
 */
export interface DiscountCode {
  code: string;
  percentOff: number;
}

export const DISCOUNT_CODES: Record<string, DiscountCode> = {
  NEW10: { code: "NEW10", percentOff: 10 },
  // Internal QA only - 98% off brings the ₪50 monthly plan down to exactly
  // ₪1 (Math.round(50 * 0.02) = 1), for testing the real Grow checkout +
  // webhook end-to-end without a meaningful charge. Not meant for customer
  // use; remove once payment testing is done.
  TEST1: { code: "TEST1", percentOff: 98 },
};

export function getDiscountCode(input: string | undefined | null): DiscountCode | null {
  const code = (input ?? "").trim().toUpperCase();
  if (!code) return null;
  return DISCOUNT_CODES[code] ?? null;
}

/** Price after a discount code, rounded to the nearest shekel. */
export function applyDiscount(priceIls: number, discount: DiscountCode | null): number {
  if (!discount) return priceIls;
  return Math.round(priceIls * (1 - discount.percentOff / 100));
}
