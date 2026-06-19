"use client";
import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

// Resend the confirmation email from the graceful error state, so an expired or mis-clicked link is
// never a dead end. Uses the same callback redirect as signup.
export function ResendConfirm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter the email you signed up with.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setDone(true);
    } catch {
      setError("We could not resend just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p style={{ color: "#6fe6a0", fontSize: 14, margin: 0 }}>Sent. Check your inbox for a fresh link.</p>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        className="input"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
      />
      {error && <p style={{ color: "#f08c82", fontSize: 13, margin: 0 }}>{error}</p>}
      <button className="btn btn-solid" disabled={busy} onClick={resend}>
        {busy ? "Sending..." : "Resend confirmation"}
      </button>
    </div>
  );
}
