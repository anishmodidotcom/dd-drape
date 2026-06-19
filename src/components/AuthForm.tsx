"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";

// Email/password auth (v1). Signup adds: show-password toggle, confirm-password, inline written
// validation, and Terms/Privacy consent (MN6).
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string; agree?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  function validate(): boolean {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "That email does not look right.";
    if (!password) e.password = "Enter a password.";
    else if (password.length < 8) e.password = "Use at least 8 characters.";
    if (isSignup) {
      if (!confirm) e.confirm = "Re-enter your password.";
      else if (confirm !== password) e.confirm = "Passwords do not match.";
      if (!agree) e.agree = "Please accept the terms to continue.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setNotice(null);
    if (!validate()) return;
    setBusy(true);
    const supabase = getBrowserClient();
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in.");
          setBusy(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/app/new");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  const errStyle = { color: "#f08c82", fontSize: 13, margin: "6px 0 0" };

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "grid", gap: 16 }}>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" aria-invalid={!!errors.email} />
        {errors.email && <p style={errStyle}>{errors.email}</p>}
      </div>

      <div>
        <label className="label" htmlFor="password">Password</label>
        <div style={{ position: "relative" }}>
          <input
            id="password"
            className="input"
            type={show ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            aria-invalid={!!errors.password}
            style={{ paddingRight: 64 }}
          />
          <button type="button" onClick={() => setShow((s) => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--fog)", cursor: "pointer", fontSize: 13 }}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {errors.password && <p style={errStyle}>{errors.password}</p>}
      </div>

      {isSignup && (
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" className="input" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" aria-invalid={!!errors.confirm} />
          {errors.confirm && <p style={errStyle}>{errors.confirm}</p>}
        </div>
      )}

      {isSignup && (
        <div>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--fog)" }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              I agree to the <Link href="/terms" style={{ color: "var(--saffron)" }}>Terms</Link> and{" "}
              <Link href="/privacy" style={{ color: "var(--saffron)" }}>Privacy Policy</Link>.
            </span>
          </label>
          {errors.agree && <p style={errStyle}>{errors.agree}</p>}
        </div>
      )}

      {error && <p style={{ color: "#f08c82", fontSize: 14, margin: 0 }}>{error}</p>}
      {notice && <p style={{ color: "#6fe6a0", fontSize: 14, margin: 0 }}>{notice}</p>}

      <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ minWidth: 120 }}>
        {busy ? "One moment..." : isSignup ? "Create account" : "Sign in"}
      </button>

      <p className="muted" style={{ fontSize: 14, textAlign: "center", margin: 0 }}>
        {isSignup ? (
          <>Already have an account? <Link href="/login" style={{ color: "var(--saffron)" }}>Sign in</Link></>
        ) : (
          <>New to Oviya Studio? <Link href="/signup" style={{ color: "var(--saffron)" }}>Create an account</Link></>
        )}
      </p>
    </form>
  );
}
