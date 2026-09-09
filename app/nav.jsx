"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Feed", d: "M3 12h4l3 8 4-16 3 8h4" },
  { href: "/resume", label: "Resume", d: "M6 2h8l4 4v16H6zM14 2v4h4" },
  { href: "/referrals", label: "Refer", d: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 8h4M19 6v4" },
  { href: "/pipeline", label: "Pipeline", d: "M3 6h18M3 12h18M3 18h10" },
  { href: "/settings", label: "You", d: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2 2 2 0 11-4 0 1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 004.6 15a2 2 0 110-4 1.7 1.7 0 001.2-2.9l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0011.5 4a2 2 0 114 0 1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 001.2 2.9 2 2 0 110 4 1.7 1.7 0 00-1.5 1z" },
];

export default function Nav() {
  const path = usePathname() || "/";
  return (
    <nav className="nav">
      <div className="nav-inner">
        {ITEMS.map((it) => {
          const on = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link key={it.href} href={it.href} className={on ? "on" : ""}>
              <svg className="dot" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={it.d} />
              </svg>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
