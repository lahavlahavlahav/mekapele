// =============================================================================
// PRICING — heart packages (Stripe checkout) + generation cost rules
// -----------------------------------------------------------------------------
// Pure data/logic, safe to import from both client and server code.
// =============================================================================

export interface HeartPackage {
  id: "1" | "5" | "10";
  hearts: number;
  priceIls: number;
  popular?: boolean;
}

export const HEART_PACKAGES: HeartPackage[] = [
  { id: "1", hearts: 1, priceIls: 19 },
  { id: "5", hearts: 5, priceIls: 75, popular: true },
  { id: "10", hearts: 10, priceIls: 150 },
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
