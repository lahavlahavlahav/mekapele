// =============================================================================
// POST /api/generate  — the gated, server-side measurement generator
// -----------------------------------------------------------------------------
// Security pipeline, in order:
//   1. CORS preflight + origin check
//   2. Rate limit (per uid / IP)
//   3. Auth: verify Firebase ID token  → 401 if missing/invalid
//   4. Upload validation: MIME + size + magic bytes  → 400 if bad
//   5. Consume 1 credit (atomic)  → 402 if insufficient
//   6. Run the real algorithm with sharp  → return full measurements
//
// The browser only ever gets a LOW-RES preview from its own Canvas code; the
// exact measurements exist only behind this authenticated, metered route.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { hit, clientIp } from "@/lib/security/rateLimit";
import { corsHeaders, isOriginAllowed } from "@/lib/security/cors";
import {
  validateUpload,
  MAX_UPLOAD_BYTES,
} from "@/lib/security/validateUpload";
import { extractPixelGridServer } from "@/lib/security/imageProcessorServer";
import { generateFoldingPattern } from "@/lib/algorithm";
import { consumeCredits, ensureUserProfile } from "@/lib/firestore/projects";
import type { BookConfig } from "@/lib/types";

export const runtime = "nodejs"; // sharp needs the Node runtime
export const maxDuration = 30;

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  // 1. Origin allow-list (defense in depth alongside browser CORS).
  if (origin && !isOriginAllowed(origin)) {
    return NextResponse.json(
      { error: "Origin not allowed." },
      { status: 403, headers: cors }
    );
  }

  // 3a. Auth first so we can rate-limit per user when possible.
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to generate measurements." },
      { status: 401, headers: cors }
    );
  }

  // 2. Rate limit (10 generations / minute / user).
  const limit = hit(`gen:${user.uid}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          ...cors,
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))
          ),
        },
      }
    );
  }

  // Parse multipart form: image file + JSON config.
  let file: File | null = null;
  let config: BookConfig;
  try {
    const form = await req.formData();
    file = form.get("image") as File | null;
    config = JSON.parse(String(form.get("config") || "{}")) as BookConfig;
  } catch {
    return NextResponse.json(
      { error: "Malformed request." },
      { status: 400, headers: cors }
    );
  }

  if (!file) {
    return NextResponse.json(
      { error: "No image provided." },
      { status: 400, headers: cors }
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 5 MB limit." },
      { status: 413, headers: cors }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // 4. Validate the bytes BEFORE sharp touches them.
  const v = validateUpload(file.type, bytes.length, bytes);
  if (!v.ok) {
    return NextResponse.json(
      { error: v.error },
      { status: 400, headers: cors }
    );
  }

  // Basic config sanity (don't trust client numbers).
  if (
    !Number.isFinite(config.totalPages) ||
    config.totalPages < 2 ||
    config.totalPages % 2 !== 0 ||
    !Number.isFinite(config.pageHeightCm) ||
    config.pageHeightCm <= 0 ||
    !Number.isFinite(config.pageWidthCm) ||
    config.pageWidthCm <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid book parameters." },
      { status: 400, headers: cors }
    );
  }

  // Make sure the user doc exists (first-time login), then meter the action.
  await ensureUserProfile(user.uid, user.email);

  // 5. Consume one credit atomically; 402 if out of credits.
  const remaining = await consumeCredits(user.uid, 1);
  if (remaining === null) {
    return NextResponse.json(
      { error: "Out of credits.", code: "INSUFFICIENT_CREDITS" },
      { status: 402, headers: cors }
    );
  }

  // 6. The real work — server-only.
  try {
    const grid = await extractPixelGridServer(bytes);
    const pattern = generateFoldingPattern(grid, config);
    return NextResponse.json(
      { pattern, creditsRemaining: remaining },
      { status: 200, headers: cors }
    );
  } catch {
    // Processing failed AFTER charging — refund the credit to be fair.
    // (grantCredits is webhook-grade but safe to reuse here server-side.)
    const { grantCredits } = await import("@/lib/firestore/projects");
    await grantCredits(user.uid, 1).catch(() => {});
    return NextResponse.json(
      { error: "Could not process this image." },
      { status: 500, headers: cors }
    );
  }
}
