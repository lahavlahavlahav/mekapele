import type { Metadata } from "next";
import Link from "next/link";
import { COMPLEX_FOLD_THRESHOLD, HEART_PACKAGES } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "שאלות נפוצות — Mekapele",
  description: "איך מחושבת מורכבות הדגם, איך עובד מודל הלבבות, ואיך רוכשים עוד.",
};

const FAQS = [
  {
    q: "איך מחושבת מורכבות הדגם?",
    a: `כל תבנית נמדדת לפי מספר הקיפולים הכולל שלה. עד ${COMPLEX_FOLD_THRESHOLD} קיפולים נחשבת "תבנית פשוטה", ומעל ${COMPLEX_FOLD_THRESHOLD} קיפולים נחשבת "תבנית מורכבת". הסיווג נקבע אוטומטית ומוצג לכם לפני שמאשרים את היצירה.`,
  },
  {
    q: "איך עובד מודל הלבבות?",
    a: "כל יצירת תבנית עולה לבבות: תבנית פשוטה עולה לב 1 (❤️), ותבנית מורכבת עולה 2 לבבות (❤️❤️). העלות והיתרה שלכם מוצגות תמיד לפני האישור הסופי, כך שאין הפתעות.",
  },
  {
    q: "מה קורה אם נגמרו לי הלבבות?",
    a: "אפשר לרכוש חבילת לבבות נוספת בכל עת דרך כפתור הלבבות בראש הדף, או ישירות ממסך האישור אם היתרה לא מספיקה. התשלום מאובטח ומתבצע דרך Stripe.",
  },
  {
    q: "האם הלבבות שלי פגים תוקף?",
    a: "לא. לבבות שנרכשו נשמרים בחשבון שלכם לתמיד ולא פוקעים — אפשר להשתמש בהם מתי שנוח לכם.",
  },
];

export default function FaqPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <header className="mb-8">
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--coral-deep)" }}>
          ← חזרה לסטודיו
        </Link>
        <h1 className="font-display text-3xl mt-3 mb-1">שאלות נפוצות</h1>
        <p className="text-[var(--ink-soft)]">כל מה שצריך לדעת על תבניות ולבבות.</p>
      </header>

      <div className="space-y-4">
        {FAQS.map((item) => (
          <section
            key={item.q}
            className="rounded-[var(--radius)] p-5"
            style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
          >
            <h2 className="font-display text-lg mb-2">{item.q}</h2>
            <p className="text-[var(--ink-soft)] leading-relaxed">{item.a}</p>
          </section>
        ))}

        <section
          className="rounded-[var(--radius)] p-5"
          style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
        >
          <h2 className="font-display text-lg mb-3">חבילות לבבות</h2>
          <ul className="space-y-1.5 text-[var(--ink-soft)]">
            {HEART_PACKAGES.map((pkg) => (
              <li key={pkg.id} className="flex justify-between">
                <span>
                  {pkg.hearts} {pkg.hearts === 1 ? "לב" : "לבבות"}
                  {pkg.popular && (
                    <span className="mr-2 text-xs font-bold" style={{ color: "var(--coral-deep)" }}>
                      (הכי משתלם)
                    </span>
                  )}
                </span>
                <span className="font-semibold tabular">₪{pkg.priceIls}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
