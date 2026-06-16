import { getBalance, getTransactions } from "@/lib/data";
import { GetCreditsModal } from "@/components/GetCreditsModal";

export const metadata = { title: "Credits. Drape." };

const KIND_LABEL: Record<string, string> = {
  grant: "Granted",
  reserve: "Reserved",
  settle: "Settled",
  refund: "Refunded",
};

export default async function CreditsPage() {
  const [balance, txns] = await Promise.all([getBalance(), getTransactions(100)]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 6 }}>Credits</p>
          <div style={{ fontSize: 44, fontFamily: "var(--font-display)", fontWeight: 600 }}>
            {balance.toLocaleString()}
          </div>
          <p className="muted" style={{ margin: 0 }}>1 credit = $0.01 of generation. 400 free on signup.</p>
        </div>
        <GetCreditsModal />
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "color-mix(in srgb, var(--line) 30%, white)" }}>
              <th style={{ padding: "12px 16px" }}>Type</th>
              <th style={{ padding: "12px 16px" }}>Note</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Balance</th>
              <th style={{ padding: "12px 16px" }}>When</th>
            </tr>
          </thead>
          <tbody>
            {txns.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 24, textAlign: "center" }} className="muted">
                  No transactions yet.
                </td>
              </tr>
            )}
            {txns.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ padding: "12px 16px" }}>{KIND_LABEL[t.kind] ?? t.kind}</td>
                <td style={{ padding: "12px 16px" }} className="muted">{t.note ?? ""}</td>
                <td style={{ padding: "12px 16px", textAlign: "right", color: t.amount >= 0 ? "var(--success)" : "var(--ink)" }}>
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
    </>
  );
}
