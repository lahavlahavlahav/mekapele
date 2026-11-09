import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Renders the blog's inline markup: **bold** and [text](href). Internal
 * links (starting with "/") use next/link; external ones open normally.
 */
export default function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={m.index}>{m[1]}</strong>);
    } else {
      const href = m[3];
      const cls = "underline font-semibold";
      const style = { color: "var(--coral-deep)" };
      out.push(
        href.startsWith("/") ? (
          <Link key={m.index} href={href} className={cls} style={style}>
            {m[2]}
          </Link>
        ) : (
          <a key={m.index} href={href} className={cls} style={style}>
            {m[2]}
          </a>
        )
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
