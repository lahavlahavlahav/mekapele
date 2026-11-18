import type { Metadata } from "next";
import Link from "next/link";
import { MONTHLY_PLAN } from "@/lib/pricing";
import Footer from "@/components/Footer";
import Disclosure from "@/components/ui/Disclosure";
import JsonLd from "@/components/JsonLd";
import { ALL_FAQS, FAQ_GROUPS, faqJsonLd } from "@/lib/faq";

export const metadata: Metadata = {
  title: "שאלות נפוצות — Mekapele",
  description: "איך עובד המנוי החודשי, מה ההבדל בין שיטות הקיפול, ומה זו צביעה.",
};

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

      <JsonLd data={faqJsonLd(ALL_FAQS)} />
      <div className="space-y-6">
        {FAQ_GROUPS.map((group) => (
          <section key={group.title} className="space-y-2">
            <h2 className="font-display text-xl">{group.title}</h2>
            {group.items.map((item, i) => (
              <Disclosure key={item.q} title={item.q} level="h3" size="md" defaultOpen={i === 0}>
                <p>{item.a}</p>
              </Disclosure>
            ))}
          </section>
        ))}

        <section
          className="rounded-[var(--radius)] p-5"
          style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
        >
          <h2 className="font-display text-xl mb-3">מחיר</h2>
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
