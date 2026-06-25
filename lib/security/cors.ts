// =============================================================================
// CORS  (server)
// -----------------------------------------------------------------------------
// Strict allow-list. Only the production origin (and localhost in dev) may make
// cross-origin requests to our API. The allowed origin is read from an env var
// so it is never hard-coded to a wrong domain.
//
//   NEXT_PUBLIC_SITE_ORIGIN = https://mekapele.com   (production)
// =============================================================================

const DEV_ORIGINS = ["http://localhost:3000"];

function allowedOrigins(): string[] {
  const prod = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  const list = prod ? [prod] : [];
  if (process.env.NODE_ENV !== "production") list.push(...DEV_ORIGINS);
  return list;
}

/** Returns CORS headers if the request origin is allowed, else restrictive. */
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = allowedOrigins();
  const isAllowed = origin !== null && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0] ?? "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function isOriginAllowed(origin: string | null): boolean {
  return origin !== null && allowedOrigins().includes(origin);
}
