import type { Metadata } from "next";
import Link from "next/link";
import { MONTHLY_PLAN } from "@/lib/pricing";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "שאלות נפוצות — Mekapele",
  description: "איך עובד המנוי החודשי, מה ההבדל בין שיטות הקיפול, ומה זו צביעה.",
};

const FAQS = [
  {
    q: "איך עובד המנוי?",
    a: `מנוי חודשי עולה ₪${MONTHLY_PLAN.priceIls} ומעניק ${MONTHLY_PLAN.days} יום של תבניות ללא הגבלה - כמה תמונות, כמה שיטות וכמה עדכונים שרוצים. התשלום מאובטח ומתבצע דרך Grow.`,
  },
  {
    q: "המנוי מתחדש לבד?",
    a: "לא. אין הוראת קבע - כשהחודש נגמר פשוט מצטרפים שוב כשרוצים. אם מאריכים לפני שהמנוי נגמר, הימים שנשארו נשמרים ומתווספים.",
  },
  {
    q: "מה ההבדל בין סימון וקיפול (MMF) לבין גזירה וקיפול?",
    a: "בסימון וקיפול (MMF) מסמנים קו אחד — או כמה קווים, במצב Multiline — על כל עמוד ומקפלים לאורכו, בלי לחתוך את הנייר בכלל. זו השיטה הבטוחה, המהירה והפשוטה יותר לעבודה. בגזירה וקיפול, בנוסף לסימון גם חותכים חלק מהעמוד לפני הקיפול, מה שמאפשר תבליט חד ומדויק יותר, אך דורש זהירות רבה יותר וכלי חיתוך מתאים.",
  },
  {
    q: "מה זו צביעה?",
    a: "שיטה חדשה: במקום לגזור, צובעים. מסמנים בכל דף את אותם זוגות סימונים כמו בגזירה וקיפול, אבל במקום לגזור ביניהם צובעים את קצה הדף בצבע שבחרתם (טוש, צבע אקרילי או ספוג). הקטעים הצבועים יחד יוצרים את התמונה בצבע על חזית הספר. בוחרים את הצבע בהגדרות ורואים אותו מיד בתצוגת ה-3D.",
  },
  {
    q: "איזו שיטת קיפול כדאי לי לבחור?",
    a: "אם זו הפעם הראשונה שלכם, או שאתם מחפשים תהליך מהיר ובטוח — התחילו בסימון וקיפול (MMF). אם חשוב לכם תבליט חד וברור יותר ואתם כבר בטוחים בעבודה עם סכין גזירה — גזירה וקיפול תיתן תוצאה מרשימה יותר. רוצים צבע ובלי לחתוך את הספר? צביעה.",
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
        <p className="text-[var(--ink-soft)]">כל מה שצריך לדעת על תבניות ועל המנוי.</p>
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
          <h2 className="font-display text-lg mb-3">מחיר</h2>
          <p className="flex justify-between items-baseline text-[var(--ink-soft)]">
            <span>
              <span className="font-semibold text-[var(--ink)]">{MONTHLY_PLAN.label}</span> - תבניות ללא
              הגבלה ל-{MONTHLY_PLAN.days} יום
            </span>
            <span className="font-semibold tabular">₪{MONTHLY_PLAN.priceIls}</span>
          </p>
        </section>
      </div>

      <Footer />
    </div>
  );
}
