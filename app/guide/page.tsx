import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "מדריך קצר לשימוש — Mekapele",
  description: "איך הופכים תמונה לתבנית קיפול ספרים במקפלא, צעד אחר צעד: העלאה, עמודים וגובה, שיטת קיפול, תצוגת 3D, קיפול והדפסה.",
  alternates: { canonical: "/guide" },
};

type Step = {
  title: string;
  img: string;
  w: number;
  h: number;
  alt: string;
  body: React.ReactNode;
};

const STEPS: Step[] = [
  {
    title: "מעלים תמונה",
    img: "/guide/1-upload.jpg",
    w: 900,
    h: 1080,
    alt: "חלון הפיכת תמונה לציור קווים, עם מחוון כמות פרטים",
    body: (
      <>
        <p>
          לוחצים <b>בחרו תמונה</b>. אפשר להעלות תמונה בשחור־לבן (לוגו, צללית, שם או מילה), ואפשר גם סתם תמונה
          מהטלפון: האתר מסיר את הרקע והופך אותה לציור קווים שחורים.
        </p>
        <p>
          עם המחוון <b>כמות פרטים</b> בוחרים כמה פרטים להשאיר. בשורת הכלים יש מחק, עט שחור ומילוי, לתיקונים קטנים.
          כשזה נראה טוב: <b>המשך עם הציור</b>.
        </p>
      </>
    ),
  },
  {
    title: "מזינים עמודים וגובה",
    img: "/guide/2-pages.jpg",
    w: 1100,
    h: 184,
    alt: "השדות עמוד ראשון, עמוד אחרון וגובה העמוד",
    body: (
      <ul className="list-disc pr-5 space-y-1">
        <li>
          <b>עמוד ראשון</b> ו<b>עמוד אחרון</b>: טווח העמודים שתקפלו בספר.
        </li>
        <li>
          <b>גובה העמוד</b>: הגובה הפיזי של דף אחד, בס״מ.
        </li>
        <li>
          <b>שפת הספר / כיוון</b>: RTL לספר בעברית או בערבית, LTR לספר באנגלית.
        </li>
      </ul>
    ),
  },
  {
    title: "בוחרים שיטת קיפול",
    img: "/guide/3-technique.jpg",
    w: 520,
    h: 160,
    alt: "תפריט שיטת קיפול: גזירה וקיפול, סימון וקיפול, צביעה",
    body: (
      <ul className="list-disc pr-5 space-y-1">
        <li>
          <b>סימון וקיפול (MMF)</b>: מסמנים קו (או כמה קווים) על כל עמוד ומקפלים לאורכו, בלי לחתוך. הכי פשוט ובטוח,
          ומומלץ לפעם הראשונה.
        </li>
        <li>
          <b>גזירה וקיפול</b>: בנוסף לסימון גם חותכים חלק מהעמוד. התבליט יוצא חד ומדויק יותר, וצריך זהירות וכלי
          חיתוך מתאים.
        </li>
        <li>
          <b>צביעה</b>: במקום לגזור, צובעים את קצה הדף בין הסימונים, והתמונה מופיעה בצבע על חזית הספר.
        </li>
      </ul>
    ),
  },
  {
    title: "מציצים בתצוגת 3D",
    img: "/guide/4-3d.jpg",
    w: 1100,
    h: 1320,
    alt: "תצוגת תלת־ממד של הספר המקופל",
    body: (
      <p>
        לפני שמתחילים, לוחצים <b>תצוגת 3D</b> ורואים בחינם איך הספר ייראה כשיהיה מקופל. לא אהבתם? משנים הגדרות
        ובודקים שוב.
      </p>
    ),
  },
  {
    title: "יוצרים תבנית ומקפלים עמוד אחרי עמוד",
    img: "/guide/5-tracker.jpg",
    w: 1100,
    h: 464,
    alt: "מסך העבודה: מספר העמוד, הסימונים בס״מ ופס ההתקדמות",
    body: (
      <p>
        לוחצים <b>צרו תבנית</b>. בכל עמוד מופיעים מספר העמוד והסימונים המדויקים בס״מ. מסמנים, מקפלים, לוחצים{" "}
        <b>קיפלתי</b> וממשיכים לעמוד הבא. פס ההתקדמות זוכר איפה עצרתם, גם אם סוגרים את הדף.
      </p>
    ),
  },
  {
    title: "או מדפיסים את כל התבנית",
    img: "/guide/6-pdf.jpg",
    w: 1100,
    h: 718,
    alt: "טבלת התבנית בקובץ PDF",
    body: (
      <p>
        מעדיפים נייר? <b>ייצוא טבלה (PDF)</b> או <b>ייצוא מפת קיפולים (PDF)</b>, ומדפיסים. התבניות נשמרות גם תחת{" "}
        <b>התבניות שלי</b>.
      </p>
    ),
  },
];

export default function GuidePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <header className="mb-8">
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--coral-deep)" }}>
          ← חזרה לסטודיו
        </Link>
        <h1 className="font-display text-3xl mt-3 mb-1">מדריך קצר לשימוש במקפלא</h1>
        <p className="text-[var(--ink-soft)]">מתמונה אחת לתבנית קיפול מוכנה, בשישה צעדים.</p>
      </header>

      <ol className="space-y-10">
        {STEPS.map((step, i) => (
          <li key={step.title} className="space-y-3">
            <h2 className="font-display text-xl flex items-center gap-3">
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-base shrink-0"
                style={{ background: "var(--coral-deep)" }}
              >
                {i + 1}
              </span>
              {step.title}
            </h2>
            <div className="space-y-2 leading-relaxed">{step.body}</div>
            <Image
              src={step.img}
              alt={step.alt}
              width={step.w}
              height={step.h}
              sizes="(max-width: 672px) 100vw, 672px"
              className="w-full h-auto rounded-[var(--radius)]"
              style={{ border: "1px solid var(--line)" }}
            />
          </li>
        ))}
      </ol>

      <section
        className="mt-12 rounded-[var(--radius)] p-6 text-center space-y-3"
        style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
      >
        <h2 className="font-display text-2xl">מוכנים לספר הראשון?</h2>
        <p className="text-[var(--ink-soft)]">מעלים תמונה ומתחילים. שאלות? כתבו לי ואשמח לעזור.</p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-full font-semibold text-white"
            style={{ background: "var(--coral-deep)" }}
          >
            ליצירת תבנית
          </Link>
          <Link
            href="/faq"
            className="inline-block px-6 py-3 rounded-full font-semibold"
            style={{ border: "1px solid var(--line)" }}
          >
            שאלות נפוצות
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
