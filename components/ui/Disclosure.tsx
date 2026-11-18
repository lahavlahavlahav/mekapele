import type { ReactNode } from "react";

/**
 * A clickable heading that opens and closes its content. Built on native
 * <details>/<summary>, so it works with keyboard and screen readers, needs
 * no JavaScript, and the content stays in the HTML for search engines.
 */
export default function Disclosure({
  title,
  children,
  defaultOpen = false,
  level = "h2",
  size = "lg",
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Heading level of the title, to keep the page outline correct. */
  level?: "h2" | "h3";
  size?: "lg" | "md";
}) {
  const Heading = level;
  return (
    <details
      className="disclosure rounded-[var(--radius)]"
      style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}
      open={defaultOpen}
    >
      <summary className={size === "lg" ? "px-5 py-4" : "px-4 py-3"}>
        <Heading
          className={`disclosure-title ${
            size === "lg" ? "font-bold text-lg" : "font-semibold text-base"
          } leading-snug`}
        >
          {title}
        </Heading>
        <svg
          className="disclosure-chevron"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </summary>
      <div className={`${size === "lg" ? "px-5 pb-5" : "px-4 pb-4"} text-[var(--ink-soft)] leading-relaxed`}>
        {children}
      </div>
    </details>
  );
}
