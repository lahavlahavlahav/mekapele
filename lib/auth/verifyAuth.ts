// =============================================================================
// AUTH VERIFICATION  (server)
// -----------------------------------------------------------------------------
// Verifies the Firebase ID token sent as `Authorization: Bearer <token>`.
// Returns the decoded uid/email or null. Every gated API route calls this
// FIRST — the client cannot be trusted to assert its own identity.
// =============================================================================

import "server-only";
import { getAdminAuth } from "@/lib/firebase/admin";
import type { NextRequest } from "next/server";

export interface AuthedUser {
  uid: string;
  email: string | null;
}

export async function verifyAuth(
  req: NextRequest
): Promise<AuthedUser | null> {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1], true);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    // Expired, malformed, or revoked token → treat as unauthenticated.
    return null;
  }
}
