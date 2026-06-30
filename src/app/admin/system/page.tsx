import Link from "next/link";
import { getHealth, listAudit } from "@/lib/admin/data";

export const metadata = { title: "System. Oviya admin." };
export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const [health, audit] = await Promise.all([getHealth(), listAudit(80)]);
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header><p className="panel-eyebrow">Operator</p><h1 className="display" style={{ fontSize: "var(--step-3)" }}>System health</h1></header>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {Object.entries(health.qc).map(([k, v]) => (
          <div key={k} className="panel" style={{ padding: "10px 16px" }}><span className="panel-eyebrow">qc {k}</span><div className="display" style={{ fontSize: 24 }}>{v}</div></div>
        ))}
      </div>

      <section style={{ display: "grid", gap: 10 }}>
        <h2 className="display" style={{ fontSize: 22 }}>Stuck jobs ({health.stuck.length})</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>Queued or running for over 20 minutes. If video, confirm the worker is running.</p>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", background: "var(--surface-sunken)" }}><th style={{ padding: "8px 12px" }}>Job</th><th style={{ padding: "8px 12px" }}>Type</th><th style={{ padding: "8px 12px" }}>Status</th><th style={{ padding: "8px 12px" }}>Age</th></tr></thead>
            <tbody>
              {health.stuck.length === 0 && <tr><td colSpan={4} className="muted" style={{ padding: 16, textAlign: "center" }}>Nothing stuck.</td></tr>}
              {health.stuck.map((j) => (
                <tr key={j.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "8px 12px" }}><Link href={`/admin/users/${j.user_id}`} className="accent mono" style={{ fontSize: 11 }}>{j.id.slice(0, 8)}</Link></td>
                  <td style={{ padding: "8px 12px" }} className="mono">{j.type}</td>
                  <td style={{ padding: "8px 12px" }}>{j.status}</td>
                  <td style={{ padding: "8px 12px" }} className="muted">{Math.round((Date.now() - +new Date(j.created_at)) / 60000)}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h2 className="display" style={{ fontSize: 22 }}>Recent failures</h2>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", background: "var(--surface-sunken)" }}><th style={{ padding: "8px 12px" }}>Type</th><th style={{ padding: "8px 12px" }}>Reason</th><th style={{ padding: "8px 12px" }}>When</th></tr></thead>
            <tbody>
              {health.recentFailures.length === 0 && <tr><td colSpan={3} className="muted" style={{ padding: 16, textAlign: "center" }}>No recent failures.</td></tr>}
              {health.recentFailures.map((j) => (
                <tr key={j.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "8px 12px" }} className="mono">{j.type}</td>
                  <td style={{ padding: "8px 12px", maxWidth: 360 }} className="muted">{(j.last_error ?? "").slice(0, 120)}</td>
                  <td style={{ padding: "8px 12px" }} className="muted">{new Date(j.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h2 className="display" style={{ fontSize: 22 }}>Admin audit log</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>Every credit grant and revoke, with who and why. Empty until migration 0006 is applied.</p>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ textAlign: "left", background: "var(--surface-sunken)" }}><th style={{ padding: "8px 12px" }}>Admin</th><th style={{ padding: "8px 12px" }}>Action</th><th style={{ padding: "8px 12px" }}>Target</th><th style={{ padding: "8px 12px", textAlign: "right" }}>Amount</th><th style={{ padding: "8px 12px" }}>Reason</th><th style={{ padding: "8px 12px" }}>When</th></tr></thead>
            <tbody>
              {audit.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 16, textAlign: "center" }}>No admin actions logged.</td></tr>}
              {audit.map((a) => (
                <tr key={a.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "8px 12px" }} className="muted">{a.admin_email}</td>
                  <td style={{ padding: "8px 12px" }} className="mono">{a.action}</td>
                  <td style={{ padding: "8px 12px" }}>{a.target_user_id ? <Link href={`/admin/users/${a.target_user_id}`} className="accent mono" style={{ fontSize: 11 }}>{a.target_user_id.slice(0, 8)}</Link> : "-"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{a.amount}</td>
                  <td style={{ padding: "8px 12px" }} className="muted">{a.reason}</td>
                  <td style={{ padding: "8px 12px" }} className="muted">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
