import Link from "next/link";
import HomeApp from "@/components/HomeApp";
import JsonLd from "@/components/JsonLd";
import { POSTS } from "@/lib/blog/posts";
import { MONTHLY_PLAN } from "@/lib/pricing";

const HOME_FAQ = [
  {
    q: "מה זה מקפלא?",
    a: "מקפלא הוא מחולל תבניות לפיסול ספרים וקיפול ספרים (Book Folding). מעלים תמונה, שם או מילה, מזינים את מידות הספר, ומקבלים תבנית מדויקת למילימטר.",
  },
  {
    q: "אילו סוגי תבניות אפשר ליצור?",
    a: "שלוש שיטות: סימון וקיפול (MMF, כולל מרובה קווים), גזירה וקיפול, וצביעה - שיטה חדשה שבה צובעים את קצה הדף במקום לגזור.",
  },
  {
    q: "כמה זה עולה?",
    a: `תצוגת ה-3D חינמית ולא דורשת הרשמה. יצירת תבניות כלולה במנוי חודשי של ₪${MONTHLY_PLAN.priceIls} - תבניות ללא הגבלה, וביטול בכל עת.`,
  },
];

/** Server-rendered homepage intro: what the tool is, for people and search engines. */
function HomeIntro() {
  const card = { background: "var(--paper-2)", border: "1px solid var(--line)" };
  return (
    <section className="mt-12 space-y-6" aria-labelledby="home-intro-title">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: HOME_FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      <div>
        <h1 id="home-intro-title" className="font-display text-3xl leading-tight mb-3">
          מקפלא - מחולל תבניות לפיסול ספרים וקיפול ספרים
        </h1>
        <p className="text-[var(--ink-soft)] leading-relaxed">
          <strong className="text-[var(--ink)]">פיסול ספרים</strong> (או{" "}
          <strong className="text-[var(--ink)]">קיפול ספרים</strong>, ובאנגלית{" "}
          <span lang="en">Book Folding Art</span>) הופך ספר ישן ליצירת אמנות: לב, שם, תאריך או
          ציור שבולטים מתוך הדפים. במקפלא מעלים כל תמונה, מזינים את גובה הדף ואת טווח העמודים,
          ומקבלים <strong className="text-[var(--ink)]">תבנית פיסול ספרים</strong> מדויקת למילימטר -
          לספרים בעברית ובאנגלית - עם תצוגה תלת-ממדית חינמית של הספר המקופל לפני שמתחילים.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["סימון וקיפול (MMF)", "השיטה הקלאסית בלי גזירה - שני סימונים בכל דף וקיפול. מושלם לספר ראשון."],
          ["גזירה וקיפול", "כמה קטעים בכל דף ותבליט חד - לשמות ארוכים, תאריכים ולוגואים."],
          ["צביעה - חדש!", "במקום לגזור, צובעים את קצה הדף בצבע שבוחרים, והתמונה מופיעה בצבע על הספר."],
        ].map(([title, text]) => (
          <div key={title} className="rounded-[var(--radius)] p-4" style={card}>
            <h2 className="font-display text-lg mb-1">{title}</h2>
            <p className="text-sm text-[var(--ink-soft)] leading-relaxed">{text}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius)] p-5" style={card}>
        <h2 className="font-display text-xl mb-2">איך זה עובד?</h2>
        <ol className="list-decimal pr-6 space-y-1 text-[var(--ink-soft)] leading-relaxed">
          <li>מעלים תמונה - צללית, שם, מילה או לוגו בשחור על רקע לבן.</li>
          <li>מזינים את גובה הדף ואת העמוד הראשון והאחרון לקיפול.</li>
          <li>בוחרים שיטה, וצופים בתצוגת 3D של הספר המקופל - בחינם.</li>
          <li>יוצרים תבנית, ומקפלים עם מעקב התקדמות דף אחר דף, או מדפיסים כ-PDF.</li>
        </ol>
        <p className="mt-3 text-sm">
          <Link
            href="/blog/how-to-make-a-book-folding-pattern"
            className="underline font-semibold"
            style={{ color: "var(--coral-deep)" }}
          >
            המדריך המלא: איך להפוך כל תמונה לתבנית קיפול ספרים ←
          </Link>
        </p>
      </div>

      <div className="rounded-[var(--radius)] p-5" style={card}>
        <h2 className="font-display text-xl mb-2">מי עומדת מאחורי מקפלא?</h2>
        <p className="text-[var(--ink-soft)] leading-relaxed">
          מקפלא נבנה על ידי{" "}
          <Link href="/blog/lahav-barak" className="underline font-semibold" style={{ color: "var(--coral-deep)" }}>
            להב ברק
          </Link>
          , אמנית ומנחת סדנאות פיסול ספרים ומייסדת{" "}
          <a href="https://liloubooks.com" className="underline font-semibold" style={{ color: "var(--coral-deep)" }}>
            Lilou Books
          </a>
          , שכבר לימדה מעל 500 משתתפים לקפל ספרים. את כל מה שלמדה בסדנאות היא הכניסה לכלי אחד, בעברית.
        </p>
      </div>

      <div>
        <h2 className="font-display text-xl mb-2">מהבלוג</h2>
        <ul className="space-y-1.5">
          {POSTS.map((p) => (
            <li key={p.slug} lang={p.lang}>
              <Link href={`/blog/${p.slug}`} className="underline" style={{ color: "var(--coral-deep)" }}>
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl">שאלות נפוצות</h2>
        {HOME_FAQ.map((f) => (
          <div key={f.q} className="rounded-[var(--radius)] p-4" style={card}>
            <h3 className="font-semibold mb-1">{f.q}</h3>
            <p className="text-[var(--ink-soft)] leading-relaxed">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return <HomeApp intro={<HomeIntro />} />;
}
