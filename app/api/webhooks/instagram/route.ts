// =============================================================================
// /api/webhooks/instagram — "comment 'מקפלא' → get the guide in a DM"
// -----------------------------------------------------------------------------
// Replaces a paid comment-to-DM tool. Instagram (Instagram API with Instagram
// Login) calls this URL whenever someone comments on one of the account's
// posts/reels. If the comment contains the keyword, we send the commenter ONE
// private reply (a DM tied to their comment) with the guide link, and post a
// short public reply under the comment so others see it works.
//
// Setup (Meta for Developers → app → Instagram → API setup with Instagram login):
//   • Webhook callback URL: https://www.mekapele.com/api/webhooks/instagram
//     Verify token: the value of INSTAGRAM_VERIFY_TOKEN. Subscribe to "comments".
//   • Permissions: instagram_business_basic, instagram_business_manage_comments,
//     instagram_business_manage_messages (Advanced Access via App Review so it
//     works for every commenter, not only accounts with a role on the app).
//   • Vercel env vars:
//       INSTAGRAM_VERIFY_TOKEN   any random string, same as in the Meta dashboard
//       INSTAGRAM_APP_SECRET     app secret — used to verify X-Hub-Signature-256
//       INSTAGRAM_ACCESS_TOKEN   long-lived Instagram user access token
//       INSTAGRAM_USER_ID        optional; defaults to "me"
//
// Safety:
//   • Every POST must carry a valid X-Hub-Signature-256 (fails closed if the
//     app secret isn't configured).
//   • Each comment is handled once: igCommentReplies/{commentId} is created
//     with create(), which fails if it already exists (Meta retries deliveries).
//   • The account's own comments (our public replies) are ignored, so it can
//     never loop.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminDb } from "@/lib/firebase/admin";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

const GRAPH = "https://graph.instagram.com/v21.0";

/** Words that trigger the DM. Compared after stripping niqqud, quotes and spaces. */
const KEYWORDS = ["מקפלא", "מקפלה", "mekapele"];

const DM_TEXT = () =>
  `היי! תודה שהגבת 💛\n` +
  `הנה המדריך הקצר לשימוש במקפלא, צעד אחר צעד:\n${SITE_URL}/guide\n\n` +
  `ואם יש שאלות, אפשר לכתוב לי כאן.`;

const PUBLIC_REPLY_TEXT = "שלחתי לך הודעה בפרטי 💌";

function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud & cantillation
    .replace(/["'״׳`]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function matchesKeyword(text: string | undefined | null): boolean {
  if (!text) return false;
  const t = normalize(text);
  return KEYWORDS.some((k) => t.includes(normalize(k)));
}

function validSignature(raw: string, header: string | null, secret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const got = header.slice("sha256=".length);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex"));
}

async function graphPost(path: string, body: Record<string, unknown>, token: string) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram API ${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// --- GET: webhook verification handshake -------------------------------------
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = process.env.INSTAGRAM_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type CommentValue = {
  id?: string;
  text?: string;
  parent_id?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string };
};

// --- POST: comment notifications ---------------------------------------------
export async function POST(req: NextRequest) {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const raw = await req.text();

  if (!secret || !validSignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  if (!token) {
    console.error("[instagram] INSTAGRAM_ACCESS_TOKEN is not set");
    return NextResponse.json({ ok: true, skipped: "no token" });
  }

  let payload: { object?: string; entry?: { id?: string; changes?: { field?: string; value?: CommentValue }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true, skipped: "bad json" });
  }

  const igUser = process.env.INSTAGRAM_USER_ID || "me";
  const db = getAdminDb();
  const results: string[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments") continue;
      const c = change.value ?? {};
      if (!c.id || !matchesKeyword(c.text)) continue;
      // Never answer our own comments (including the public reply below).
      if (c.from?.id && entry.id && c.from.id === entry.id) continue;

      const ref = db.collection("igCommentReplies").doc(c.id);
      try {
        await ref.create({
          commentId: c.id,
          mediaId: c.media?.id ?? null,
          username: c.from?.username ?? null,
          text: c.text ?? "",
          createdAt: new Date(),
          status: "pending",
        });
      } catch {
        results.push(`${c.id}:duplicate`);
        continue; // already handled (Meta retry)
      }

      try {
        await graphPost(`${igUser}/messages`, { recipient: { comment_id: c.id }, message: { text: DM_TEXT() } }, token);
        let publicReply = "skipped";
        try {
          await graphPost(`${c.id}/replies`, { message: PUBLIC_REPLY_TEXT }, token);
          publicReply = "sent";
        } catch (e) {
          console.error("[instagram] public reply failed", e);
          publicReply = "failed";
        }
        await ref.update({ status: "sent", publicReply, sentAt: new Date() });
        results.push(`${c.id}:sent`);
      } catch (e) {
        console.error("[instagram] private reply failed", e);
        await ref.update({ status: "failed", error: String(e).slice(0, 500) });
        results.push(`${c.id}:failed`);
      }
    }
  }

  // Always 200 so Meta doesn't keep retrying a delivery we've already logged.
  return NextResponse.json({ ok: true, results });
}
