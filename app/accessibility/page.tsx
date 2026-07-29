import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "הצהרת נגישות — Mekapele",
  description: "מחויבות מקפלא לנגישות דיגיטלית ואמצעי ההתאמה הזמינים באתר.",
};

export default function AccessibilityStatementPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <header className="mb-8">
        <Link href="/" className="text-sm font-semibold" style={{ color: "var(--coral-deep)" }}>
          ← חזרה לסטודיו
        </Link>
        <h1 className="font-display text-3xl mt-3 mb-1">הצהרת נגישות</h1>
      </header>

      <div
        className="space-y-4 text-[var(--ink-soft)] leading-relaxed rounded-[var(--radius)] p-5"
        style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
      >
        <p>
          אתר מקפלא (Mekapele) פועל להנגשת השירותים והתכנים שלו לכלל הציבור, כולל
          אנשים עם מוגבלויות, ומאמין ששירות דיגיטלי צריך להיות זמין וידידותי לכולם.
        </p>

        <p>
          <strong>אמצעי הנגישות באתר:</strong> בפינה השמאלית התחתונה של כל עמוד מוצג
          כפתור נגישות (♿) המאפשר: הגדלת גודל הטקסט, מעבר לניגודיות גבוהה, הדגשת
          קישורים, ועצירת אנימציות. ההעדפות נשמרות בדפדפן שלכם לביקורים הבאים.
        </p>

        <p>
          אתר זה נבנה תוך שימת דגש על מבנה סמנטי, ניווט מקלדת, ותיאורי alt לתמונות
          מרכזיות. עם זאת, ייתכנו רכיבים שטרם עברו התאמה מלאה לתקן הישראלי (ת"י
          5568) ברמה AA, במיוחד באזורי תצוגה מורכבים כמו התצוגה התלת-ממדית.
        </p>

        <p>
          <strong>נתקלתם בבעיית נגישות?</strong> נשמח לדעת ולתקן. אפשר לפנות דרך{" "}
          <Link href="/contact" className="underline font-semibold">
            עמוד יצירת הקשר
          </Link>
          , ואנו נחזור אליכם בהקדם.
        </p>

        <p className="text-xs">עודכן לאחרונה: 2026.</p>
      </div>

      <Footer />
    </div>
  );
}
