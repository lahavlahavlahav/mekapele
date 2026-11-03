// =============================================================================
// GET /api/subscription
// -----------------------------------------------------------------------------
// The signed-in user's monthly-pass status. subscriptions/{uid} is not
// readable from the browser (firestore.rules default-deny), so this is how
// the header badge and the generate button learn whether the pass is active.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { ensureUserProfile, getActiveUntil } from "@/lib/firestore/projects";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  // Claims any guest purchase made under this email before reporting.
  await ensureUserProfile(user.uid, user.email);
  const activeUntil = await getActiveUntil(user.uid, user.email);
  return NextResponse.json({ activeUntil, active: activeUntil > Date.now() });
}
