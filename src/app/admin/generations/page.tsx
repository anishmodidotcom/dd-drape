import Link from "next/link";
import { listAllJobs } from "@/lib/admin/data";

export const metadata = { title: "Generations. Oviya admin." };
export const dynamic = "force-dynamic";

function fidelityOf(payload: Record<string, unknown>): string {
  const meta = (payload?.meta ?? {}) as Record<string, unknown>;
  return (meta.fidelity as string) ?? "-";
}

export default async function AdminGenerationsPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string }> }) {
  const { status, type } = await searchParams;
  const jobs = await listAllJobs({ status, type });
  const link = (k: string, v: string, cur?: string) => `/admin/generations?${new URLSearchParams({ ...(status && k !== "status" ? { status } : {}), ...(type && k !== "type" ? { type } : {}), ...(cur === v ? {} : { [k]: v }) }).toString()}`;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header><p className="panel-eyebrow">Across the platform</p><h1 className="display" style={{ fontSize: "var(--step-3)" }}>Generations</h1></header>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
        <span className="muted" style={{ alignSelf: "center" }}>Status</span>
        {["done", "failed", "running", "queued"].map((s) => (
          <Link key={s} href={link("status", s, status)} className="chip" style={{ borderColor: status === s ? "var(--accent-default)" : undefined, color: status === s ? "var(--accent-default)" : undefined }}>{s}</Link>
        ))}
        <span className="muted" style={{ alignSelf: "center", marginLeft: 12 }}>Type</span>
        {["image", "video", "model"].map((t) => (
          <Link key={t} href={link("type", t, type)} className="chip" style={{ borderColor: type === t ? "var(--accent-default)" : undefined, color: type === t ? "var(--accent-default)" : undefined }}>{t}</Link>
        ))}
        {(status || type) && <Link href="/admin/generations" className="chip">clear</Link>}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ textAlign: "left", background: "var(--surface-sunken)" }}>
            <th style={{ padding: "10px 14px" }}>User</th><th style={{ padding: "10px 14px" }}>Type</th><th style={{ padding: "10px 14px" }}>Status</th><th style={{ padding: "10px 14px" }}>Tier</th><th style={{ padding: "10px 14px" }}>Fidelity</th><th style={{ padding: "10px 14px", textAlign: "right" }}>Credits</th><th style={{ padding: "10px 14px" }}>When</th>
          </tr></thead>
          <tbody>
            {jobs.length === 0 && <tr><td colSpan={7} className="muted" style={{ padding: 24, textAlign: "center" }}>No generations match.</td></tr>}
            {jobs.map((j) => (
              <tr key={j.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <td style={{ padding: "10px 14px" }}><Link href={`/admin/users/${j.user_id}`} className="accent" style={{ fontSize: 12 }}>{j.user_email ?? j.user_id.slice(0, 8)}</Link></td>
                <td style={{ padding: "10px 14px" }} className="mono">{j.type}</td>
                <td style={{ padding: "10px 14px" }}><span className={`chip ${j.status === "failed" ? "chip-red" : j.status === "done" ? "chip-green" : ""}`}>{j.status}</span></td>
                <td style={{ padding: "10px 14px" }} className="muted">{j.tier ?? "-"}</td>
                <td style={{ padding: "10px 14px" }} className="muted">{fidelityOf(j.payload)}</td>
                <td style={{ padding: "10px 14px", textAlign: "right" }}>{j.actual_credits ?? j.estimated_credits}</td>
                <td style={{ padding: "10px 14px" }} className="muted">{new Date(j.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Most recent 150. Failed jobs were refunded by the engine.</p>
    </div>
  );
}
