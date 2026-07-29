// =============================================================================
// POST /api/generate  — the gated, server-side measurement generator
// -----------------------------------------------------------------------------
// Security pipeline, in order:
//   1. CORS preflight + origin check
//   2. Rate limit (per uid / IP)
//   3. Auth: verify Firebase ID token  → 401 if missing/invalid
//   4. Upload validation: MIME + size + magic bytes  → 400 if bad
//   5. Run the real algorithm with sharp to get the AUTHORITATIVE fold count
//   6. Consume the required hearts for that complexity (atomic) → 402 if short
//
// The client shows its own locally-computed fold count/cost estimate in the
// confirmation modal for a snappy UI, but this route recomputes it
// server-side and charges off THAT number — the client's number is never
// trusted for billing.
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
import { generateFoldingPattern, countFolds } from "@/lib/algorithm";
import { consumeHearts, ensureUserProfile } from "@/lib/firestore/projects";
import { classifyComplexity, heartsRequired } from "@/lib/pricing";
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
    !Number.isFinite(config.firstPage) ||
    !Number.isFinite(config.lastPage) ||
    config.firstPage < 1 ||
    config.lastPage < 1 ||
    config.firstPage === config.lastPage ||
    !Number.isFinite(config.pageHeightCm) ||
    config.pageHeightCm <= 0 ||
    !Number.isFinite(config.verticalSpacingCm) ||
    config.verticalSpacingCm <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid book parameters." },
      { status: 400, headers: cors }
    );
  }

  // Make sure the user doc exists (first-time login), then meter the action.
  await ensureUserProfile(user.uid, user.email);

  // 5. Run the real algorithm first — we need the authoritative fold count
  // to know how many hearts this pattern actually costs.
  let pattern;
  try {
    const grid = await extractPixelGridServer(bytes);
    pattern = generateFoldingPattern(grid, config);
  } catch {
    return NextResponse.json(
      { error: "Could not process this image." },
      { status: 500, headers: cors }
    );
  }

  const foldCount = countFolds(pattern);
  const complexity = classifyComplexity(foldCount);
  const cost = heartsRequired(foldCount);

  // 6. Consume the required hearts atomically; 402 if insufficient.
  const remaining = await consumeHearts(user.uid, cost);
  if (remaining === null) {
    return NextResponse.json(
      {
        error: "Not enough hearts.",
        code: "INSUFFICIENT_HEARTS",
        foldCount,
        complexity,
        requiredHearts: cost,
      },
      { status: 402, headers: cors }
    );
  }

  return NextResponse.json(
    { pattern, foldCount, complexity, heartsCharged: cost, heartsRemaining: remaining },
    { status: 200, headers: cors }
  );
}
