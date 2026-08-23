import type { Metadata } from "next";
import Link from "next/link";
import { COMPLEX_FOLD_THRESHOLD, HEART_PACKAGES } from "@/lib/pricing";
import Footer from "@/components/Footer";

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
    q: "מה ההבדל בין סימון וקיפול (MMF) לבין גזירה וקיפול?",
    a: "בסימון וקיפול (MMF) מסמנים קו אחד — או כמה קווים, במצב Multiline — על כל עמוד ומקפלים לאורכו, בלי לחתוך את הנייר בכלל. זו השיטה הבטוחה, המהירה והפשוטה יותר לעבודה. בגזירה וקיפול, בנוסף לסימון גם חותכים חלק מהעמוד לפני הקיפול, מה שמאפשר תבליט חד ומדויק יותר, אך דורש זהירות רבה יותר וכלי חיתוך מתאים.",
  },
  {
    q: "איזו שיטת קיפול כדאי לי לבחור?",
    a: "אם זו הפעם הראשונה שלכם, או שאתם מחפשים תהליך מהיר ובטוח — התחילו בסימון וקיפול (MMF). אם חשוב לכם תבליט חד וברור יותר ואתם כבר בטוחים בעבודה עם סכין גזירה — גזירה וקיפול תיתן תוצאה מרשימה יותר.",
  },
  {
    q: "איך עובד מודל הלבבות?",
    a: "כל יצירת תבנית עולה לבבות: תבנית פשוטה עולה לב 1 (❤️), ותבנית מורכבת עולה 2 לבבות (❤️❤️). העלות והיתרה שלכם מוצגות תמיד לפני האישור הסופי, כך שאין הפתעות.",
  },
  {
    q: "מה קורה אם נגמרו לי הלבבות?",
    a: "אפשר לרכוש חבילת לבבות נוספת בכל עת דרך כפתור הלבבות בראש הדף, או ישירות ממסך האישור אם היתרה לא מספיקה. התשלום מאובטח ומתבצע דרך Grow.",
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
          <ul className="space-y-2 text-[var(--ink-soft)]">
            {HEART_PACKAGES.map((pkg) => (
              <li key={pkg.id} className="flex justify-between items-baseline">
                <span>
                  <span className="font-semibold text-[var(--ink)]">{pkg.label}</span>
                  {pkg.popular && (
                    <span className="mr-2 text-xs font-bold" style={{ color: "var(--coral-deep)" }}>
                      (הכי משתלם)
                    </span>
                  )}
                  {pkg.subtitle && <span className="block text-xs">{pkg.subtitle}</span>}
                </span>
                <span className="font-semibold tabular">₪{pkg.priceIls}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Footer />
    </div>
  );
}
