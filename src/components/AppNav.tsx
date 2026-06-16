"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app/new", label: "New shot" },
  { href: "/app/shots", label: "My shots" },
  { href: "/app/credits", label: "Credits" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} className="navlink" data-active={active}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
