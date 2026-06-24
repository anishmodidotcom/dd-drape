import { getBalance, getTransactions, type CreditTxn } from "@/lib/data";
import { GetCreditsModal } from "@/components/GetCreditsModal";

export const metadata = { title: "Credits. Oviya Studio." };

const KIND_LABEL: Record<string, string> = {
  grant: "Added",
  reserve: "Reserved",
  settle: "Charged",
  refund: "Refunded",
};

// Human-readable description (MN5): never leak internal codes like "image/hero" or "est=15 act=15".
function describe(t: CreditTxn): string {
  const note = (t.note ?? "").trim();
  // Legacy/internal codes -> friendly fallback.
  if (!note || /image\/|video\/|model\/|est=|act=|^reserve$|^settle$|^refund/i.test(note)) {
    if (t.kind === "grant") return note.includes("signup") ? "Signup credit" : "Credit top-up";
    if (t.kind === "refund") return "Refunded";
    return "Shot";
  }
  if (t.kind === "grant" && /signup/i.test(note)) return "Signup credit";
  return note;
}

export default async function CreditsPage() {
  const [balance, txns] = await Promise.all([getBalance(), getTransactions(100)]);

  return (
    <div className="page">
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 16, background: "linear-gradient(180deg, var(--surface-raised), var(--surface-base))" }}>
        <div>
          <p className="panel-eyebrow">Credits</p>
          <div className="display" style={{ fontSize: "var(--step-4)", fontWeight: 600, lineHeight: 1, margin: "4px 0" }}>
            {balance.toLocaleString()}
          </div>
          <p className="muted" style={{ margin: 0 }}>One credit is one cent of generation. Every signup starts with 400 free.</p>
        </div>
        <GetCreditsModal />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "var(--surface-2)" }}>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Activity</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>Type</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>Amount</th>
              <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>Balance</th>
              <th style={{ padding: "12px 16px", fontWeight: 600 }}>When</th>
            </tr>
          </thead>
          <tbody>
            {txns.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: "center" }} className="muted">
                  No activity yet.
                </td>
              </tr>
            )}
            {txns.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                <td style={{ padding: "12px 16px" }}>{describe(t)}</td>
                <td style={{ padding: "12px 16px" }} className="muted">{KIND_LABEL[t.kind] ?? t.kind}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", color: t.amount >= 0 ? "#6fe6a0" : "var(--porcelain)" }}>
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount}
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>{t.balance_after}</td>
                <td style={{ padding: "12px 16px" }} className="muted">
                  {new Date(t.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
