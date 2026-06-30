import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserDetail } from "@/lib/admin/data";
import { CreditAdjustForm } from "@/components/admin/CreditAdjustForm";

export const metadata = { title: "User. Oviya admin." };
export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getUserDetail(id);
  if (!d) notFound();
  const u = d.user;

  return (
    <div style={{ display: "grid", gap: 22 }}>
      <Link href="/admin/users" className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Users</Link>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="panel-eyebrow">Account</p>
          <h1 className="display" style={{ fontSize: "var(--step-2)" }}>{u.email ?? u.id}</h1>
          <p className="muted mono" style={{ fontSize: 12 }}>{u.id}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="panel-eyebrow">Balance</span>
          <div className="display" style={{ fontSize: 36, fontWeight: 600 }}>{u.balance.toLocaleString()}</div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Info label="Joined" value={new Date(u.created_at).toLocaleString()} />
        <Info label="Confirmed" value={u.confirmed ? "Yes" : "Pending"} />
        <Info label="Last seen" value={u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "never"} />
        <Info label="Shots" value={String(d.jobs.filter((j) => !String(j.type).startsWith("model/")).length)} />
        <Info label="Models" value={String(d.models.length)} />
        <Info label="Saved products" value={String(d.products.length)} />
      </div>

      <CreditAdjustForm userId={u.id} />

      <Section title="Transaction ledger">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ textAlign: "left", background: "var(--surface-sunken)" }}>
            <th style={{ padding: "8px 12px" }}>Kind</th><th style={{ padding: "8px 12px", textAlign: "right" }}>Amount</th><th style={{ padding: "8px 12px", textAlign: "right" }}>Balance</th><th style={{ padding: "8px 12px" }}>Note</th><th style={{ padding: "8px 12px" }}>When</th>
          </tr></thead>
          <tbody>
            {d.transactions.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 16, textAlign: "center" }}>No transactions.</td></tr>}
            {d.transactions.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "8px 12px" }} className="mono">{t.kind}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: t.amount >= 0 ? "var(--success)" : "var(--text-primary)" }}>{t.amount >= 0 ? "+" : ""}{t.amount}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>{t.balance_after}</td>
                <td style={{ padding: "8px 12px" }} className="muted">{t.note}</td>
                <td style={{ padding: "8px 12px" }} className="muted">{new Date(t.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={`Generations (${d.jobs.length})`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, padding: 12 }}>
          {d.jobs.slice(0, 40).map((j) => (
            <Link key={j.id} href={`/app/shots/${j.id}`} className="panel" style={{ padding: 10, display: "grid", gap: 4 }}>
              <span className="mono" style={{ fontSize: 11 }}>{j.type}</span>
              <span className="chip" style={{ width: "fit-content", fontSize: 10 }}>{j.status}</span>
              <span className="muted" style={{ fontSize: 10 }}>{new Date(j.created_at).toLocaleDateString()}</span>
            </Link>
          ))}
          {d.jobs.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No generations.</p>}
        </div>
      </Section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="panel" style={{ padding: 12 }}><span className="panel-eyebrow">{label}</span><div style={{ fontSize: 15, marginTop: 2 }}>{value}</div></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 10 }}>
      <h2 className="display" style={{ fontSize: 22 }}>{title}</h2>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>{children}</div>
    </section>
  );
}
