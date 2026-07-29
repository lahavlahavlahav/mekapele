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
