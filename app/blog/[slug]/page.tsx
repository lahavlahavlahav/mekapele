import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import RichText from "@/components/blog/RichText";
import { POSTS, getPost, type Block } from "@/lib/blog/posts";
import { CREATOR, OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    authors: [{ name: CREATOR.name, url: CREATOR.url }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      locale: post.lang === "he" ? "he_IL" : "en_US",
      publishedTime: post.date,
      authors: [CREATOR.name],
      images: [OG_IMAGE],
    },
  };
}

function renderBlock(block: Block, i: number, lang: "he" | "en") {
  if ("h2" in block) return <h2 key={i} className="font-display text-2xl mt-8 mb-3">{block.h2}</h2>;
  if ("h3" in block) return <h3 key={i} className="font-display text-lg mt-5 mb-2">{block.h3}</h3>;
  if ("p" in block)
    return (
      <p key={i} className="mb-4 leading-relaxed">
        <RichText text={block.p} />
      </p>
    );
  if ("ul" in block || "ol" in block) {
    const items = "ul" in block ? block.ul : block.ol;
    const Tag = "ul" in block ? "ul" : "ol";
    return (
      <Tag
        key={i}
        className={`mb-4 space-y-2 leading-relaxed ${Tag === "ul" ? "list-disc" : "list-decimal"} ${
          lang === "he" ? "pr-6" : "pl-6"
        }`}
      >
        {items.map((item, j) => (
          <li key={j}>
            <RichText text={item} />
          </li>
        ))}
      </Tag>
    );
  }
  return (
    <div
      key={i}
      className="my-6 rounded-[var(--radius)] p-5 text-center"
      style={{ background: "rgba(226,97,74,0.08)", border: "1px solid var(--coral)" }}
    >
      <p className="font-semibold mb-3">{block.cta}</p>
      <Link
        href="/"
        className="inline-block px-5 py-2.5 rounded-[var(--radius)] font-semibold text-white"
        style={{ background: "var(--coral)" }}
      >
        {lang === "he" ? "למחולל התבניות ←" : "Open the pattern generator →"}
      </Link>
    </div>
  );
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  const he = post.lang === "he";
  const url = `${SITE_URL}/blog/${post.slug}`;
  const others = POSTS.filter((p) => p.slug !== post.slug && p.lang === post.lang).slice(0, 3);

  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      url,
      mainEntityOfPage: url,
      datePublished: post.date,
      dateModified: post.date,
      inLanguage: post.lang,
      keywords: post.keywords.join(", "),
      image: `${SITE_URL}${OG_IMAGE}`,
      author: { "@type": "Person", name: CREATOR.name, alternateName: CREATOR.alternateName, url: CREATOR.url },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/assets/mekapele-logo.png` },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "בלוג", item: `${SITE_URL}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];
  if (post.faq?.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <JsonLd data={jsonLd} />
      <nav className="text-sm mb-6" dir="rtl">
        <Link href="/" className="font-semibold" style={{ color: "var(--coral-deep)" }}>
          {SITE_NAME}
        </Link>
        {" / "}
        <Link href="/blog" className="font-semibold" style={{ color: "var(--coral-deep)" }}>
          בלוג
        </Link>
      </nav>

      <article lang={post.lang} dir={he ? "rtl" : "ltr"}>
        <header className="mb-6">
          <h1 className="font-display text-3xl leading-tight mb-2">{post.title}</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            {he ? "מאת " : "By "}
            <Link href="/blog/lahav-barak" className="underline">
              {he ? CREATOR.name : CREATOR.alternateName}
            </Link>
            {" · "}
            {new Date(post.date).toLocaleDateString(he ? "he-IL" : "en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {" · "}
            {post.readMinutes} {he ? "דק׳ קריאה" : "min read"}
          </p>
        </header>

        {post.blocks.map((b, i) => renderBlock(b, i, post.lang))}

        {post.faq?.length ? (
          <section className="mt-8">
            <h2 className="font-display text-2xl mb-3">{he ? "שאלות נפוצות" : "FAQ"}</h2>
            <div className="space-y-3">
              {post.faq.map((f) => (
                <div
                  key={f.q}
                  className="rounded-[var(--radius)] p-4"
                  style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
                >
                  <h3 className="font-semibold mb-1">{f.q}</h3>
                  <p className="text-[var(--ink-soft)] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </article>

      {others.length > 0 && (
        <aside className="mt-10" dir={he ? "rtl" : "ltr"}>
          <h2 className="font-display text-xl mb-3">{he ? "עוד מהבלוג" : "More from the blog"}</h2>
          <ul className="space-y-2">
            {others.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="underline font-semibold" style={{ color: "var(--coral-deep)" }}>
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}

      <Footer />
    </div>
  );
}
