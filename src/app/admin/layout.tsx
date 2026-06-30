import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Wordmark } from "@/components/ui/Wordmark";

// Admin shell. requireAdminPage() 404s any non-admin before a single byte of admin data is read.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <div className="appshell">
      <header className="appbar">
        <Link href="/admin" aria-label="Oviya admin" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Wordmark size="sm" withStudio={false} />
          <span className="chip" style={{ fontSize: 10, background: "var(--accent-default)", color: "var(--accent-contrast)", borderColor: "transparent" }}>ADMIN</span>
        </Link>
        <AdminNav />
        <div className="appbar-spacer" />
        <Link href="/app/new" className="appbar-tab">Studio</Link>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{admin.email}</span>
        <ThemeToggle />
      </header>
      <main className="appmain"><div className="page">{children}</div></main>
    </div>
  );
}
