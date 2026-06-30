import { getOverview } from "@/lib/admin/data";

export const metadata = { title: "Admin overview. Oviya Studio." };
export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card" style={{ display: "grid", gap: 4 }}>
      <span className="panel-eyebrow">{label}</span>
      <span className="display" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1 }}>{value}</span>
      {sub && <span className="muted" style={{ fontSize: 12 }}>{sub}</span>}
    </div>
  );
}

function Sparkline({ series }: { series: { day: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const w = 600, h = 80, n = series.length;
  const pts = series.map((s, i) => [(i / Math.max(1, n - 1)) * w, h - (s.count / max) * (h - 8) - 4]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-label="Signups, last 14 days">
      <path d={`${d}`} fill="none" stroke="var(--accent-default)" strokeWidth="2" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill="var(--accent-default)" />)}
    </svg>
  );
}

export default async function AdminOverviewPage() {
  const o = await getOverview();
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header><p className="panel-eyebrow">Operator</p><h1 className="display" style={{ fontSize: "var(--step-3)" }}>Overview</h1></header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        <Stat label="Users" value={o.totalUsers.toLocaleString()} sub={`${o.signups7d} new in 7 days`} />
        <Stat label="Active (7d)" value={o.activeUsers7d.toLocaleString()} sub="generated something" />
        <Stat label="Generations" value={o.totalGenerations.toLocaleString()} sub={`${o.stills} stills, ${o.videos} videos`} />
        <Stat label="Failure rate" value={`${(o.failureRate * 100).toFixed(1)}%`} sub={`${o.failed} failed`} />
      </div>

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <strong className="display" style={{ fontSize: 18 }}>Signups, last 14 days</strong>
          <span className="muted mono" style={{ fontSize: 11 }}>{o.signups7d} this week</span>
        </div>
        <Sparkline series={o.signupSeries} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Stat label="Credits granted" value={o.creditsGranted.toLocaleString()} sub="signup + admin grants" />
        <Stat label="Credits spent" value={o.creditsSpent.toLocaleString()} sub="reserved + settled" />
        <Stat label="Credits refunded" value={o.creditsRefunded.toLocaleString()} sub="failures + blocks" />
      </div>
      <p className="muted" style={{ fontSize: 12 }}>Credits are 1 cent of generation each. Spend shown is reserved/settled debits across all users.</p>
    </div>
  );
}
