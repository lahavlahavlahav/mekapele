// =============================================================================
// POST /api/liloubooks/checkout  — checkout for the liloubooks.com shop
// -----------------------------------------------------------------------------
// liloubooks.com is a static site (GitHub Pages), so its checkout lives here.
// The browser sends the cart lines and customer details; this route:
//   1. reprices every line from the shop's own catalog.json (the browser's
//      prices are never trusted),
//   2. emails the full order to the owner (Formspree), so no order is lost,
//   3. asks the same Make scenario Mekapele used to create a one-time Grow
//      payment page for exactly that total, and returns its URL.
// If step 3 fails (Grow has been answering 1500 in Make), the order is still
// recorded by step 2: the response carries orderId with paymentUrl null and
// the shop tells the buyer a payment link will follow.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { hit } from "@/lib/security/rateLimit";
import { createPaymentLink } from "@/lib/payment/make";

export const runtime = "nodejs";

const SHOP_ORIGINS = [
  "https://liloubooks.com",
  "https://www.liloubooks.com",
  "http://localhost:8099",
];
const CATALOG_URL = "https://liloubooks.com/shop/catalog.json";
const FORMSPREE_URL = "https://formspree.io/f/mzzjvvqv";
/**
 * "manual": the owner sends the Grow payment link herself on WhatsApp (the
 * order email carries a ready wa.me link), because Grow answers 1500 to the
 * Make CreatePaymentLink module. Switch to "auto" once that works, and the
 * shop redirects straight to a dynamic Grow page for the exact total.
 */
const PAYMENT_MODE: "manual" | "auto" = "manual";

type Text = { he: string; en: string };
interface OptionValue { id: string; name: Text; delta: number }
interface Option { id: string; name: Text; values: OptionValue[] }
interface Field { id: string; name: Text; required?: boolean; max: number }
interface Product {
  id: string; cat: string; name: Text; price: number;
  options?: Option[]; addons?: string[]; fields?: Field[];
}
interface Catalog {
  shipping: Record<string, { price: number; name: Text }>;
  addons: Record<string, { price: number; name: Text }>;
  products: Product[];
}

function cors(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && SHOP_ORIGINS.includes(origin) ? origin : SHOP_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

async function loadCatalog(): Promise<Catalog> {
  const res = await fetch(CATALOG_URL, { next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`catalog HTTP ${res.status}`);
  return res.json();
}

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function newOrderId(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `LB-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  const bad = (error: string, status = 400) => NextResponse.json({ error }, { status, headers });

  if (origin && !SHOP_ORIGINS.includes(origin)) return bad("Origin not allowed.", 403);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!hit(`lb-checkout:${ip}`, 8, 60_000).allowed) return bad("Too many requests.", 429);

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > 20) {
    return bad("Malformed request.");
  }
  const he = body.lang !== "en";

  let catalog: Catalog;
  try {
    catalog = await loadCatalog();
  } catch (err) {
    console.error("liloubooks checkout: catalog unavailable", err);
    return bad(he ? "החנות לא זמינה כרגע. נסו שוב בעוד רגע." : "The shop is unavailable right now.", 503);
  }

  // ---- reprice every line from the catalog ----
  const lines: { title: string; details: string[]; qty: number; unit: number }[] = [];
  for (const raw of body.lines) {
    const p = catalog.products.find((x) => x.id === raw?.productId);
    if (!p) return bad("Unknown product.");
    const qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) return bad("Bad quantity.");
    let unit = p.price;
    const details: string[] = [];
    for (const o of p.options ?? []) {
      const v = o.values.find((x) => x.id === raw.options?.[o.id]);
      if (!v) return bad("Bad option.");
      unit += v.delta;
      details.push(`${o.name.he}: ${v.name.he}`);
    }
    for (const f of p.fields ?? []) {
      const val = str(raw.fields?.[f.id], f.max);
      if (f.required && !val) return bad(he ? "חסרים פרטים לאחד המוצרים." : "A product is missing details.");
      if (val) details.push(`${f.name.he}: ${val}`);
    }
    const addons: string[] = Array.isArray(raw.addons) ? raw.addons : [];
    for (const a of addons) {
      if (!(p.addons ?? []).includes(a) || !catalog.addons[a]) return bad("Bad add-on.");
      unit += catalog.addons[a].price;
      details.push(`+ ${catalog.addons[a].name.he}`);
    }
    lines.push({ title: p.name.he, details, qty, unit });
  }

  // ---- customer + delivery ----
  const c = body.customer ?? {};
  const firstName = str(c.firstName, 40);
  const lastName = str(c.lastName, 40);
  const email = str(c.email, 120).toLowerCase();
  const phone = str(c.phone, 20).replace(/[^\d]/g, "");
  const method = body.delivery?.method === "delivery" ? "delivery" : "pickup";
  const street = str(body.delivery?.street, 120);
  const city = str(body.delivery?.city, 60);
  const zip = str(body.delivery?.zip, 12);
  const notes = str(body.notes, 500);
  if (
    firstName.length < 2 || lastName.length < 2 ||
    !/^\S+@\S+\.\S+$/.test(email) || !/^05\d{8}$/.test(phone) ||
    (method === "delivery" && (street.length < 2 || city.length < 2)) ||
    body.terms !== true
  ) {
    return bad(he ? "נא למלא את כל פרטי ההזמנה." : "Please fill in all order details.");
  }

  const ship = catalog.shipping[method]?.price ?? 0;
  const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
  const total = subtotal + ship;
  const orderId = newOrderId();
  const fullName = `${firstName} ${lastName}`;

  // ---- 1. email the order (the record of truth until payment) ----
  const waText = he
    ? `היי ${firstName}, תודה על ההזמנה ${orderId} ב-Lilou Books! 💛\nהנה הקישור לתשלום מאובטח (₪${total}):\n`
    : `Hi ${firstName}, thank you for order ${orderId} at Lilou Books! 💛\nHere is your secure payment link (₪${total}):\n`;
  const waLink = `https://wa.me/972${phone.slice(1)}?text=${encodeURIComponent(waText)}`;
  const text = [
    `👉 לשליחת קישור התשלום בוואטסאפ: ${waLink}`,
    `(צרי בקשת תשלום ב-Grow על ₪${total} והדביקי את הקישור בסוף ההודעה)`,
    "",
    `הזמנה ${orderId} · סה"כ ₪${total}`,
    "",
    ...lines.map((l) => `• ${l.title} × ${l.qty} - ₪${l.unit * l.qty}\n   ${l.details.join(" | ")}`),
    "",
    `משלוח: ${catalog.shipping[method]?.name.he ?? method} - ₪${ship}`,
    method === "delivery" ? `כתובת: ${street}, ${city}${zip ? " " + zip : ""}` : "",
    "",
    `לקוח/ה: ${fullName} · ${phone} · ${email}`,
    notes ? `הערות: ${notes}` : "",
    `שפה: ${he ? "עברית" : "English"}`,
  ].filter((x) => x !== "").join("\n");
  try {
    const fr = await fetch(FORMSPREE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Referer: "https://liloubooks.com/shop/checkout.html", Origin: "https://liloubooks.com" },
      body: JSON.stringify({ _subject: `הזמנה חדשה ${orderId} - ₪${total}`, _replyto: email, email, name: fullName, phone, order: orderId, total, message: text }),
    });
    if (!fr.ok) console.error("liloubooks checkout: formspree", fr.status, await fr.text().catch(() => ""));
  } catch (err) {
    console.error("liloubooks checkout: formspree failed", err);
  }
  console.log("liloubooks order", JSON.stringify({ orderId, total, lines, method, email, phone }));

  if (PAYMENT_MODE === "manual") {
    return NextResponse.json({ orderId, total, paymentUrl: null }, { status: 200, headers });
  }

  // ---- 2. dynamic Grow payment page via Make ----
  const shopBase = he ? "https://liloubooks.com/shop/" : "https://liloubooks.com/en/shop/";
  try {
    const { paymentUrl } = await createPaymentLink({
      sum: total,
      description: `Lilou Books - הזמנה ${orderId}`,
      userId: orderId,
      heartsAdded: "0",
      packageId: "liloubooks",
      successUrl: `${shopBase}thank-you.html?order=${orderId}`,
      cancelUrl: `${shopBase}checkout.html`,
      fullName,
      phone,
      email,
      title: "Lilou Books",
      thankYou: he
        ? `תודה ${firstName}! ההזמנה ${orderId} התקבלה, ואתחיל לעבוד עליה בקרוב. 💛`
        : `Thank you ${firstName}! Order ${orderId} is in, and I will start working on it soon. 💛`,
    });
    return NextResponse.json({ orderId, total, paymentUrl }, { status: 200, headers });
  } catch (err) {
    console.error("liloubooks checkout: payment link failed", err);
    return NextResponse.json({ orderId, total, paymentUrl: null }, { status: 200, headers });
  }
}
