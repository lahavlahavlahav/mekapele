import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "./ContactForm";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "צור קשר — Mekapele",
  description: "שאלות, בעיות טכניות, או פניות בנוגע לפרטיות ולתקנון.",
};

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <header className="mb-8">
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--coral-deep)" }}>
          ← חזרה לסטודיו
        </Link>
        <h1 className="font-display text-3xl mt-3 mb-1">צור קשר</h1>
        <p className="text-[var(--ink-soft)]">
          שאלה, בעיה טכנית, או כל דבר אחר — נשמח לשמוע ולחזור אליכם.
        </p>
      </header>

      <ContactForm />

      <Footer />
    </div>
  );
}
