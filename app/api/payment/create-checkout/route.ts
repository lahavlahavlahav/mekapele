// =============================================================================
// POST /api/payment/create-checkout
// -----------------------------------------------------------------------------
// Starts a Grow payment process for a hearts package and returns the payment
// page URL for the browser to redirect to. The buyer's identity comes from
// their verified Firebase ID token (never trusted from the request body) so a
// caller can never trigger a purchase credited to someone else's account.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { hit } from "@/lib/security/rateLimit";
import { corsHeaders, isOriginAllowed } from "@/lib/security/cors";
import { getHeartPackage } from "@/lib/pricing";
import { createPaymentProcess } from "@/lib/payment/grow";
import { createTransaction } from "@/lib/firestore/transactions";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (origin && !isOriginAllowed(origin)) {
    return NextResponse.json(
      { error: "Origin not allowed." },
      { status: 403, headers: cors }
    );
  }

  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401, headers: cors }
    );
  }

  const limit = hit(`checkout:${user.uid}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: cors }
    );
  }

  let packageId: string;
  try {
    const body = await req.json();
    packageId = String(body.packageId ?? "");
  } catch {
    return NextResponse.json(
      { error: "Malformed request." },
      { status: 400, headers: cors }
    );
  }

  const pkg = getHeartPackage(packageId);
  if (!pkg) {
    return NextResponse.json(
      { error: "Unknown package." },
      { status: 400, headers: cors }
    );
  }

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN || origin || "";

  try {
    const { paymentUrl, growProcessId } = await createPaymentProcess({
      sum: pkg.priceIls,
      description: `${pkg.hearts} לבבות — Mekapele`,
      successUrl: `${siteOrigin}/?purchase=success`,
      cancelUrl: `${siteOrigin}/?purchase=cancelled`,
      notifyUrl: `${siteOrigin}/api/webhooks/grow`,
      cField1: user.uid,
      cField2: String(pkg.hearts),
      email: user.email ?? undefined,
    });

    await createTransaction({
      userId: user.uid,
      packageId: pkg.id,
      heartsAdded: pkg.hearts,
      amount: pkg.priceIls,
      growProcessId,
    });

    return NextResponse.json({ paymentUrl }, { status: 200, headers: cors });
  } catch (err) {
    console.error("create-checkout failed:", err);
    return NextResponse.json(
      { error: "לא ניתן היה ליצור עסקת תשלום. נסו שוב." },
      { status: 502, headers: cors }
    );
  }
}
