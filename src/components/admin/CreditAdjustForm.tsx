"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { parseJsonSafe } from "@/lib/http";

// Privileged admin control: grant or revoke a user's credits. Posts to the server-gated
// /api/admin/credits; the server validates, writes the ledger atomically, and audits it.
export function CreditAdjustForm({ userId }: { userId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"grant" | "revoke">("grant");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n <= 0) return toast("Enter a positive whole number.", "error");
    if (!reason.trim()) return toast("A reason is required for the audit log.", "error");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, amount: mode === "grant" ? n : -n, reason: reason.trim() }),
      });
      const parsed = await parseJsonSafe<{ balance: number }>(res);
      if (!parsed.ok) return toast(parsed.error ?? "Could not adjust credits.", "error");
      toast(`${mode === "grant" ? "Granted" : "Revoked"} ${n} credits. New balance ${parsed.data?.balance?.toLocaleString()}.`, "success");
      setAmount(""); setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ padding: 16, display: "grid", gap: 12 }}>
      <strong className="display" style={{ fontSize: 18 }}>Adjust credits</strong>
      <div className="seg" style={{ width: "fit-content" }}>
        <button data-on={mode === "grant"} onClick={() => setMode("grant")}>Grant</button>
        <button data-on={mode === "revoke"} onClick={() => setMode("revoke")}>Revoke</button>
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "140px 1fr" }}>
        <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (audited)" />
      </div>
      <div>
        <Button variant="primary" loading={busy} loadingLabel="Working" onClick={submit}>
          {mode === "grant" ? "Grant credits" : "Revoke credits"}
        </Button>
      </div>
      <p className="muted" style={{ fontSize: 11, margin: 0 }}>Writes to the ledger atomically and records the action in the admin audit log. Revokes clamp at zero.</p>
    </div>
  );
}
