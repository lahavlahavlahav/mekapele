import Link from "next/link";
import HomeApp from "@/components/HomeApp";
import JsonLd from "@/components/JsonLd";
import Disclosure from "@/components/ui/Disclosure";
import { POSTS } from "@/lib/blog/posts";
import { ALL_FAQS, FAQ_GROUPS, faqJsonLd } from "@/lib/faq";

const linkStyle = { color: "var(--coral-deep)" };

const METHODS = [
  ["סימון וקיפול (MMF)", "השיטה הקלאסית, בלי גזירה: שני סימונים בכל דף וקיפול. מושלם לספר ראשון."],
  ["גזירה וקיפול", "כמה קטעים בכל דף ותבליט חד. לשמות ארוכים, תאריכים ולוגואים."],
  ["צביעה - חדש!", "במקום לגזור, צובעים את קצה הדף בצבע שבוחרים, והתמונה מופיעה בצבע על הספר."],
];

/**
 * Server-rendered homepage content under the tool: a short intro, then
 * clickable headings that open one topic at a time instead of a wall of
 * text. Everything stays in the HTML for search engines.
 */
function HomeIntro() {
  return (
    <section className="mt-12 space-y-6" aria-labelledby="home-intro-title">
      <JsonLd data={faqJsonLd(ALL_FAQS)} />

      <div>
        <h1 id="home-intro-title" className="font-display text-3xl leading-tight mb-3">
          מקפלא - מחולל תבניות לפיסול ספרים וקיפול ספרים
        </h1>
        <p className="text-[var(--ink-soft)] leading-relaxed text-lg">
          מעלים תמונה, מזינים את מידות הספר, ומקבלים{" "}
          <strong className="text-[var(--ink)]">תבנית פיסול ספרים</strong> מדויקת למילימטר, לספרים
          בעברית ובאנגלית. לפני שמתחילים אפשר לראות בחינם איך הספר המקופל ייראה בתלת-ממד.
        </p>
      </div>

      <div className="space-y-3">
        <Disclosure title="איך זה עובד?" defaultOpen>
          <ol className="list-decimal pr-6 space-y-1.5">
            <li>מעלים תמונה: צללית, שם, מילה או לוגו בשחור על רקע לבן.</li>
            <li>מזינים את גובה הדף ואת העמוד הראשון והאחרון לקיפול.</li>
            <li>בוחרים שיטת קיפול וצופים בספר המקופל בתלת-ממד, בחינם.</li>
            <li>יוצרים תבנית, ומקפלים דף אחר דף עם מעקב התקדמות, או מדפיסים PDF.</li>
          </ol>
          <p className="mt-3 text-sm">
            <Link href="/blog/how-to-make-a-book-folding-pattern" className="underline font-semibold" style={linkStyle}>
              המדריך המלא: איך להפוך כל תמונה לתבנית קיפול ←
            </Link>
          </p>
        </Disclosure>

        <Disclosure title="שלוש שיטות קיפול">
          <ul className="grid gap-3 sm:grid-cols-3">
            {METHODS.map(([title, text]) => (
              <li key={title} className="rounded-[var(--radius)] p-4" style={{ border: "1px solid var(--line)" }}>
                <h3 className="font-semibold text-[var(--ink)] mb-1">{title}</h3>
                <p className="text-sm">{text}</p>
              </li>
            ))}
          </ul>
        </Disclosure>

        <Disclosure title="מה זה פיסול ספרים?">
          <p>
            <strong className="text-[var(--ink)]">פיסול ספרים</strong> (או{" "}
            <strong className="text-[var(--ink)]">קיפול ספרים</strong>, ובאנגלית{" "}
            <span lang="en">Book Folding Art</span>) הופך ספר ישן ליצירת אמנות: לב, שם, תאריך או ציור
            שבולטים מתוך הדפים. כל דף מקופל לפי מידות מדויקות, ויחד הדפים יוצרים את הצורה.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/blog/what-is-book-folding" className="underline font-semibold" style={linkStyle}>
              לקריאה נוספת ←
            </Link>
          </p>
        </Disclosure>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-2xl">שאלות נפוצות</h2>
        {FAQ_GROUPS.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="text-sm font-semibold pt-2">{group.title}</p>
            {group.items.map((f) => (
              <Disclosure key={f.q} title={f.q} level="h3" size="md">
                <p>{f.a}</p>
              </Disclosure>
            ))}
          </div>
        ))}
        <p className="text-sm">
          לא מצאתם תשובה?{" "}
          <Link href="/contact" className="underline font-semibold" style={linkStyle}>
            כתבו לנו
          </Link>
        </p>
      </div>

      <div className="space-y-3">
        <Disclosure title="מי עומדת מאחורי מקפלא?">
          <p>
            מקפלא נבנה על ידי{" "}
            <Link href="/blog/lahav-barak" className="underline font-semibold" style={linkStyle}>
              להב ברק
            </Link>
            , אמנית ומנחת סדנאות פיסול ספרים ומייסדת{" "}
            <a href="https://liloubooks.com" className="underline font-semibold" style={linkStyle}>
              Lilou Books
            </a>
            , שכבר לימדה מעל 500 משתתפים לקפל ספרים. את כל מה שלמדה בסדנאות היא הכניסה לכלי אחד, בעברית.
          </p>
        </Disclosure>

        <Disclosure title="מהבלוג">
          <ul className="space-y-2">
            {POSTS.map((p) => (
              <li key={p.slug} lang={p.lang}>
                <Link href={`/blog/${p.slug}`} className="underline" style={linkStyle}>
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </Disclosure>
      </div>
    </section>
  );
}

export default function Home() {
  return <HomeApp intro={<HomeIntro />} />;
}
