// =============================================================================
// POST /api/auth/sync
// -----------------------------------------------------------------------------
// Called once right after sign-in (see AuthProvider). Ensures the user's
// Firestore profile exists and claims any pendingCredits from a guest
// checkout made under the same email before this login — without this, that
// claim would only happen the first time the user generates a pattern.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { ensureUserProfile } from "@/lib/firestore/projects";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  await ensureUserProfile(user.uid, user.email);
  return NextResponse.json({ ok: true });
}
