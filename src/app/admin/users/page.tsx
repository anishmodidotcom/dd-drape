import Link from "next/link";
import { listUsers } from "@/lib/admin/data";

export const metadata = { title: "Users. Oviya admin." };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const users = await listUsers(q);
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div><p className="panel-eyebrow">Accounts</p><h1 className="display" style={{ fontSize: "var(--step-3)" }}>Users</h1></div>
        <form style={{ display: "flex", gap: 8 }}>
          <input className="input" name="q" defaultValue={q ?? ""} placeholder="Search email or id" style={{ minWidth: 240 }} />
          <button className="btn btn-secondary" type="submit">Search</button>
        </form>
      </header>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "var(--surface-sunken)" }}>
              <th style={{ padding: "12px 16px" }}>Email</th>
              <th style={{ padding: "12px 16px" }}>Joined</th>
              <th style={{ padding: "12px 16px" }}>Confirmed</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Balance</th>
              <th style={{ padding: "12px 16px" }}>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 24, textAlign: "center" }}>No users.</td></tr>}
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "12px 16px" }}><Link href={`/admin/users/${u.id}`} className="accent">{u.email ?? u.id.slice(0, 8)}</Link></td>
                <td style={{ padding: "12px 16px" }} className="muted">{new Date(u.created_at).toLocaleDateString()}</td>
                <td style={{ padding: "12px 16px" }}>{u.confirmed ? <span className="chip chip-green">Yes</span> : <span className="chip chip-amber">Pending</span>}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{u.balance.toLocaleString()}</td>
                <td style={{ padding: "12px 16px" }} className="muted">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Showing up to 200 accounts. Open a user for their full ledger, shots, models and credit controls.</p>
    </div>
  );
}
