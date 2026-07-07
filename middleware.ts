// =============================================================================
// MIDDLEWARE — runs before every /api/* request
// -----------------------------------------------------------------------------
// First line of defense:
//   • Strict CORS: reject cross-origin requests from disallowed origins.
//   • Coarse global rate limit by IP (per-route limits add finer control).
// Route handlers still re-check auth + per-user limits (defense in depth).
//
// Webhooks are EXEMPT from CORS/origin checks (they come from the payment
// provider's servers, not a browser) but keep their own signature verification.
// =============================================================================

import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/api/:path*"],
};

const DEV_ORIGINS = ["http://localhost:3000"];

function allowedOrigins(): string[] {
  const prod = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  const list = prod ? [prod] : [];
  if (process.env.NODE_ENV !== "production") list.push(...DEV_ORIGINS);
  return list;
}

// Lightweight per-IP limiter shared across this edge instance.
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
function ipHit(ip: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || now >= b.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Payment webhooks bypass browser-origin checks (verified by signature).
  if (pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin");
  const allowed = allowedOrigins();

  // Block disallowed cross-origin requests outright.
  if (origin && !allowed.includes(origin)) {
    return NextResponse.json(
      { error: "Origin not allowed." },
      { status: 403 }
    );
  }

  // Coarse IP rate limit.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!ipHit(ip)) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  return NextResponse.next();
}
