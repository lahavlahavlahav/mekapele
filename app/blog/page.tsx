import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { POSTS } from "@/lib/blog/posts";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "בלוג פיסול ספרים וקיפול ספרים - מדריכים, תבניות וטיפים",
  description:
    "מדריכים לפיסול ספרים וקיפול ספרים: מה זה Book Folding, סוגי תבניות (MMF, גזירה וקיפול, צביעה), איך להכין תבנית מכל תמונה ואיזה ספר לבחור.",
  alternates: { canonical: "/blog" },
};

const fmt = (iso: string, lang: "he" | "en") =>
  new Date(iso).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function BlogIndex() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "בלוג מקפלא - פיסול ספרים וקיפול ספרים",
          url: `${SITE_URL}/blog`,
          inLanguage: "he",
          blogPost: POSTS.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE_URL}/blog/${p.slug}`,
            datePublished: p.date,
            inLanguage: p.lang,
          })),
        }}
      />
      <header className="mb-8">
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--coral-deep)" }}>
          ← למחולל התבניות
        </Link>
        <h1 className="font-display text-3xl mt-3 mb-1">בלוג פיסול ספרים</h1>
        <p className="text-[var(--ink-soft)]">
          מדריכים, טיפים ותבניות לקיפול ספרים - מהספר הראשון ועד לפרויקטים מורכבים.
        </p>
      </header>

      <div className="space-y-4">
        {POSTS.map((p) => (
          <article
            key={p.slug}
            lang={p.lang}
            dir={p.lang === "he" ? "rtl" : "ltr"}
            className="rounded-[var(--radius)] p-5"
            style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
          >
            <h2 className="font-display text-xl mb-1">
              <Link href={`/blog/${p.slug}`} className="hover:underline">
                {p.title}
              </Link>
            </h2>
            <p className="text-xs text-[var(--ink-soft)] mb-2">
              {fmt(p.date, p.lang)} · {p.readMinutes} {p.lang === "he" ? "דק׳ קריאה" : "min read"}
            </p>
            <p className="text-[var(--ink-soft)] leading-relaxed">{p.excerpt}</p>
            <Link
              href={`/blog/${p.slug}`}
              className="inline-block mt-2 text-sm font-semibold"
              style={{ color: "var(--coral-deep)" }}
            >
              {p.lang === "he" ? "להמשך קריאה ←" : "Read more →"}
            </Link>
          </article>
        ))}
      </div>

      <Footer />
    </div>
  );
}
