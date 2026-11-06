import type { Metadata } from "next";
import Link from "next/link";
import CancelForm from "./CancelForm";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "ביטול מנוי — Mekapele",
  description: "ביטול הוראת הקבע של המנוי החודשי במקפלא, מתי שרוצים.",
};

export default function CancelPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <header className="mb-8">
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--coral-deep)" }}>
          ← חזרה לסטודיו
        </Link>
        <h1 className="font-display text-3xl mt-3 mb-1">ביטול מנוי</h1>
        <p className="text-[var(--ink-soft)]">
          אפשר לבטל את הוראת הקבע מתי שרוצים. ממלאים את הפרטים, והוראת הקבע
          מבוטלת - לא יהיו חיובים נוספים. החודש ששולם כבר נשאר פעיל עד סופו.
        </p>
      </header>

      <CancelForm />

      <Footer />
    </div>
  );
}
