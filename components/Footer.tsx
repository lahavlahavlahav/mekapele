import Link from "next/link";

const LINKS = [
  { href: "/faq", label: "שאלות ותשובות" },
  { href: "/terms", label: "תקנון ופרטיות" },
  { href: "/accessibility", label: "הצהרת נגישות" },
  { href: "/contact", label: "צור קשר" },
];

export default function Footer() {
  return (
    <footer
      className="mt-12 pt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="text-[var(--ink-soft)] hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </footer>
  );
}
