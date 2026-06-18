import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getBalance } from "@/lib/data";
import { AppNav } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";

// Authenticated app shell (Section 7.3): left rail nav + top bar with credit balance and account.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const balance = await getBalance();

  return (
    <div className="shell">
      <aside className="rail">
        <Link href="/" className="eyebrow" style={{ color: "var(--porcelain)", opacity: 0.9 }}>
          Drape
        </Link>
        <AppNav />
        <div className="rail-tagline" style={{ marginTop: "auto", fontSize: 12, opacity: 0.6 }}>
          Your product. Your model. Your shot.
        </div>
      </aside>
      <div className="content">
        <div className="topbar">
          <Link href="/app/credits" className="chip" title="Credit balance">
            {balance.toLocaleString()} credits
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="muted" style={{ fontSize: 13 }}>
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
        <div className="content-inner">{children}</div>
      </div>
    </div>
  );
}
