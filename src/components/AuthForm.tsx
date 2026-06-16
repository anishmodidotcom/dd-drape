"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";

// Email/password auth only (v1). No Google OAuth.
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const supabase = getBrowserClient();
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is on, there is no session yet.
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

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
      <div>
        <label className="label" htmlFor="email" style={{ color: "var(--porcelain)" }}>
          Email
        </label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@studio.com"
        />
      </div>
      <div>
        <label className="label" htmlFor="password" style={{ color: "var(--porcelain)" }}>
          Password
        </label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 14, margin: 0 }}>{error}</p>
      )}
      {notice && (
        <p style={{ color: "var(--success)", fontSize: 14, margin: 0 }}>{notice}</p>
      )}

      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "One moment..." : isSignup ? "Create account" : "Sign in"}
      </button>

      <p className="muted" style={{ fontSize: 14, textAlign: "center", margin: 0 }}>
        {isSignup ? (
          <>
            Already have an account? <Link href="/login" style={{ color: "var(--saffron)" }}>Sign in</Link>
          </>
        ) : (
          <>
            New to Drape? <Link href="/signup" style={{ color: "var(--saffron)" }}>Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
