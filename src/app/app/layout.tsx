import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getBalance } from "@/lib/data";
import { AppNav, AppBottomTabs } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";
import { Wordmark } from "@/components/ui/Wordmark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Authenticated app shell: a slim premium top bar (so the studio gets the full page) + a mobile
// bottom tab bar. Dual-mode via the Phase 1 tokens.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const balance = await getBalance();

  return (
    <div className="appshell">
      <header className="appbar">
        <Link href="/app/new" aria-label="Oviya Studio home">
          <Wordmark size="sm" />
        </Link>
        <AppNav />
        <div className="appbar-spacer" />
        <Link href="/app/credits" className="chip" title="Credit balance" style={{ fontVariantNumeric: "tabular-nums" }}>
          {balance.toLocaleString()} credits
        </Link>
        <ThemeToggle />
        <details style={{ position: "relative" }}>
          <summary style={{ listStyle: "none", cursor: "pointer", display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)", fontSize: 13, color: "var(--text-secondary)" }}>
            {(user.email ?? "?").slice(0, 1).toUpperCase()}
          </summary>
          <div className="card" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 220, display: "grid", gap: 10, zIndex: 50, boxShadow: "var(--shadow-3)" }}>
            <span className="muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{user.email}</span>
            <SignOutButton />
          </div>
        </details>
      </header>

      <main className="appmain">{children}</main>
      <AppBottomTabs />
    </div>
  );
}
