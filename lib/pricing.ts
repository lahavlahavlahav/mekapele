// =============================================================================
// PRICING — heart packages (Grow checkout via Make.com) + generation cost rules
// -----------------------------------------------------------------------------
// Pure data/logic, safe to import from both client and server code.
// =============================================================================

export interface HeartPackage {
  id: "1" | "2" | "8";
  /** Product-facing name (what the customer sees), not just a heart count. */
  label: string;
  /** Optional subtitle, e.g. explaining bundle value. */
  subtitle?: string;
  hearts: number;
  priceIls: number;
  popular?: boolean;
}

export const HEART_PACKAGES: HeartPackage[] = [
  { id: "1", label: "תבנית קלה", hearts: 1, priceIls: 19 },
  { id: "2", label: "תבנית מתקדמת", hearts: 2, priceIls: 38 },
  {
    id: "8",
    label: "באנדל משתלם",
    subtitle: "שווה ל-8 תבניות פשוטות, 4 מתקדמות, או מיקס!",
    hearts: 8,
    priceIls: 100,
    popular: true,
  },
];

export function getHeartPackage(packageId: string): HeartPackage | null {
  return HEART_PACKAGES.find((p) => p.id === packageId) ?? null;
}

/**
 * Discount codes for heart-package checkout. Validated here on both the
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
  // Internal QA only - 95% off brings the cheapest package (id "1", ₪19) down
  // to exactly ₪1 (Math.round(19 * 0.05) = 1), for testing the real Grow
  // checkout + webhook end-to-end without a meaningful charge. Not meant for
  // customer use; remove once payment testing is done.
  TEST1: { code: "TEST1", percentOff: 95 },
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

/** A pattern above this many folds is billed as "complex". */
export const COMPLEX_FOLD_THRESHOLD = 500;

export type PatternComplexity = "simple" | "complex";

export function classifyComplexity(foldCount: number): PatternComplexity {
  return foldCount > COMPLEX_FOLD_THRESHOLD ? "complex" : "simple";
}

/** Hearts required to generate a pattern with this many folds. */
export function heartsRequired(foldCount: number): number {
  return classifyComplexity(foldCount) === "complex" ? 2 : 1;
}
