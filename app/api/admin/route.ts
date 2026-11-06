// =============================================================================
// /api/admin  — owner-only tools (OWNER_TEST_EMAIL)
// -----------------------------------------------------------------------------
// GET  → the last Grow webhook deliveries (growWebhookLog), to see whether
//        Grow sent anything and what it looked like.
// POST { email, days } → grant subscription days by hand (a buyer who paid
//        with a different email, a missed notification...). Parked in
//        pendingCredits like a guest purchase, so it's claimed the next time
//        that email's account loads the site.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verifyAuth";
import { getAdminDb } from "@/lib/firebase/admin";
import { OWNER_TEST_EMAIL } from "@/lib/firestore/projects";
import { MONTHLY_PLAN } from "@/lib/pricing";

export const runtime = "nodejs";

async function requireOwner(req: NextRequest) {
  const user = await verifyAuth(req);
  return user?.email === OWNER_TEST_EMAIL ? user : null;
}

export async function GET(req: NextRequest) {
  if (!(await requireOwner(req))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const db = getAdminDb();
  const [logs, credits] = await Promise.all([
    db.collection("growWebhookLog").orderBy("receivedAt", "desc").limit(15).get(),
    db.collection("pendingCredits").orderBy("createdAt", "desc").limit(15).get(),
  ]);
  return NextResponse.json({
    webhooks: logs.docs.map((d) => d.data()),
    credits: credits.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
}

export async function POST(req: NextRequest) {
  const owner = await requireOwner(req);
  if (!owner) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const days = Number(body.days ?? MONTHLY_PLAN.days);
  if (!/^\S+@\S+\.\S+$/.test(email) || !Number.isInteger(days) || days <= 0 || days > 366) {
    return NextResponse.json({ error: "אימייל או מספר ימים לא תקינים." }, { status: 400 });
  }
  await getAdminDb().collection("pendingCredits").doc(`manual-${Date.now()}`).set({
    email,
    daysAdded: days,
    planId: MONTHLY_PLAN.id,
    claimed: false,
    manual: true,
    createdAt: Date.now(),
  });
  return NextResponse.json({ ok: true });
}
