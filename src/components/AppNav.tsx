"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The product tabs. "model" not "muse"; clear names, no cute jargon.
export const TABS = [
  { href: "/app/new", label: "Studio", glyph: "✦" },
  { href: "/app/models", label: "Models", glyph: "◐" },
  { href: "/app/shots", label: "My Shots", glyph: "▦" },
  { href: "/app/video", label: "Video", glyph: "▷" },
  { href: "/app/replace", label: "Replace", glyph: "⇄" },
  { href: "/app/credits", label: "Credits", glyph: "◆" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="appbar-nav" aria-label="Sections">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="appbar-tab" data-active={isActive(pathname, t.href)}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

// Thumb-reachable bottom bar on mobile (the five core tabs; Credits via the balance chip).
export function AppBottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="app-bottomtabs" aria-label="Sections">
      {TABS.slice(0, 5).map((t) => (
        <Link key={t.href} href={t.href} data-active={isActive(pathname, t.href)}>
          <span aria-hidden style={{ fontSize: 15 }}>{t.glyph}</span>
          {t.label}
          <span className="dot" aria-hidden />
        </Link>
      ))}
    </nav>
  );
}
