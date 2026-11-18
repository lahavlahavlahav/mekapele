"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

/**
 * The Mekapele logo as a "home" link: always lands on the settings screen,
 * with the image the person already chose (kept in the store as draftImage).
 */
export default function HomeLogo({ className = "h-9 w-auto" }: { className?: string }) {
  const setView = useStore((s) => s.setView);
  const pathname = usePathname();

  return (
    <Link
      href="/"
      aria-label="מקפלא - חזרה לעמוד הראשי"
      className="shrink-0"
      onClick={(e) => {
        setView("config");
        if (pathname === "/") {
          // Already on the homepage: just switch views, no reload.
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/mekapele-logo.png" alt="מקפלא - מחולל תבניות לפיסול ספרים" className={className} />
    </Link>
  );
}
