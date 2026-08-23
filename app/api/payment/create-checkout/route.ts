// =============================================================================
// POST /api/payment/create-checkout
// -----------------------------------------------------------------------------
// Single responsibility: ask the Make.com scenario to create a one-time Grow
// payment page and hand the browser its URL to redirect to. Nothing here
// touches Firestore — the webhook (app/api/webhooks/grow), called directly
// by Grow (not through Make), owns every write once payment is confirmed.
//
// Signing in is NOT required to check out — purchase should never be
// blocked on auth working. If the request carries a valid Firebase ID
// token, hearts go straight to that uid (still never trusted from the
// request body — always the verified token). Otherwise this is a guest
// checkout: the buyer's email (typed into the purchase form, required in
// that case) identifies them, and lib/firestore/projects.ts's
// claimPendingCredits hands the hearts over automatically the first time
// someone signs in with that same email.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { hit } from "@/lib/security/rateLimit";
import { corsHeaders, isOriginAllowed } from "@/lib/security/cors";
import { applyDiscount, getDiscountCode, getHeartPackage } from "@/lib/pricing";
import { createPaymentLink } from "@/lib/payment/make";

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

  // Optional: if a valid token is present, use its verified uid/email. If
  // not (or verification fails), this is a guest checkout — not rejected.
  const authedUser = await verifyAuth(req);

  let packageId: string;
  let fullName: string;
  let phone: string;
  let email: string;
  let couponCode: string;
  try {
    const body = await req.json();
    packageId = String(body.packageId ?? "");
    fullName = String(body.fullName ?? "").trim();
    phone = String(body.phone ?? "").trim();
    email = String(body.email ?? "").trim().toLowerCase();
    couponCode = String(body.couponCode ?? "").trim();
  } catch {
    return NextResponse.json(
      { error: "Malformed request." },
      { status: 400, headers: cors }
    );
  }

  const buyerEmail = authedUser?.email ?? email;
  const rateLimitKey = authedUser?.uid ?? buyerEmail ?? "anon";
  const limit = hit(`checkout:${rateLimitKey}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: cors }
    );
  }

  const pkg = getHeartPackage(packageId);
  if (!pkg) {
    return NextResponse.json(
      { error: "Unknown package." },
      { status: 400, headers: cors }
    );
  }

  // Grow requires a real full name + Israeli mobile number to create a
  // payment page — validate server-side too, don't trust the client alone.
  // A guest (no verified token) also needs a real-looking email so the
  // purchase can be claimed once they sign in.
  const emailValid = /^\S+@\S+\.\S+$/.test(buyerEmail);
  if (
    fullName.split(/\s+/).filter(Boolean).length < 2 ||
    !/^05\d{8}$/.test(phone) ||
    !emailValid
  ) {
    return NextResponse.json(
      { error: "נא להזין שם מלא, טלפון נייד ואימייל תקינים." },
      { status: 400, headers: cors }
    );
  }

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN || origin || "";

  // The client may show a discounted price preview, but the amount actually
  // charged always comes from re-validating the code here, never from
  // anything the client claims the price already is.
  const discount = getDiscountCode(couponCode);
  const sum = applyDiscount(pkg.priceIls, discount);

  try {
    const { paymentUrl } = await createPaymentLink({
      sum,
      description: discount
        ? `${pkg.label} — Mekapele (${discount.code} -${discount.percentOff}%)`
        : `${pkg.label} — Mekapele`,
      successUrl: `${siteOrigin}/?purchase=success`,
      cancelUrl: `${siteOrigin}/?purchase=cancelled`,
      email: buyerEmail,
      fullName,
      phone,
      userId: authedUser?.uid ?? "",
      packageId: pkg.id,
      heartsAdded: String(pkg.hearts),
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
