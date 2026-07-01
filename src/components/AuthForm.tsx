"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";

// Turn ANY thrown value into a clean human string. Never lets a raw object/Error/symbol reach a
// setState -> JSX render (the source of a stray "{}" or "[object Object]" in the DOM: rendering a
// non-Error object, or an Error whose .message is missing/empty, previously fell through to
// String(err) territory in ad hoc catch blocks elsewhere in the app). This is the single place auth
// errors are translated, so the guarantee is centralized, not re-derived per call site.
export function authMessage(err: unknown): string {
  const raw =
    err instanceof Error && err.message
      ? err.message
      : typeof err === "string" && err
        ? err
        : typeof err === "object" && err !== null && "message" in err && typeof (err as { message?: unknown }).message === "string"
          ? ((err as { message: string }).message)
          : "";

  // Map known Supabase auth error text to calm, on-brand copy (no vendor names, no raw codes).
  if (/already registered|already exists|user_already_exists/i.test(raw)) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (/invalid login credentials/i.test(raw)) {
    return "That email or password is not right. Please try again.";
  }
  if (/email not confirmed/i.test(raw)) {
    return "Please confirm your email first. Check your inbox for the link.";
  }
  if (/rate limit|too many/i.test(raw)) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (/network|fetch failed|failed to fetch/i.test(raw)) {
    return "We could not reach the server. Check your connection and try again.";
  }
  // A specific message is only shown verbatim if it reads like a real sentence (has a space and
  // ends in punctuation-free prose), never a bare error-class/code string like "AuthApiError:
  // unexpected_failure" or "PGRST116" - those fall back to the generic message instead of leaking
  // implementation detail to the user.
  if (raw && /\s/.test(raw) && !/^[A-Za-z]+(Error|Exception):/.test(raw) && !/^[a-z0-9_]+$/i.test(raw)) {
    return raw;
  }
  return "Something went wrong. Please try again.";
}

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
    if (busy) return; // guard against a double submit (double-click, slow network + repeat Enter)
    setError(null);
    setNotice(null);
    if (!validate()) return;
    setBusy(true);
    try {
      // Init the client INSIDE the try so a misconfigured environment (missing/incorrect public
      // Supabase env vars) surfaces as a clean message instead of an uncaught throw that breaks the
      // render. This is also the code-vs-config tell: this branch means the env is not set right.
      const supabase = getBrowserClient();
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // Land the confirmation link on our callback route, which exchanges the code, establishes
          // the session, and shows a branded welcome (never a dead page).
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        // Email confirmation ON => no session yet; the user must confirm. (Supabase also returns a
        // sessionless success for an existing address, to prevent enumeration, so we show the same
        // reassuring notice either way.)
        if (!data.session) {
          setNotice("Check your inbox to confirm your email. The link brings you right back to step on set.");
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
      // Permanent diagnostic breadcrumb: console only, never shown to the user (the user always
      // sees authMessage(err), a clean string). Without this, a thrown error before any network
      // request (e.g. a client-config problem) is otherwise invisible: nothing reaches the network
      // tab and nothing reaches the server, so devtools console is the only place to see it.
      console.error(
        "[oviya:auth]",
        err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err
      );
      setError(authMessage(err)); // always a clean string; never an object/symbol
      setBusy(false);
    }
  }

  const errStyle = { color: "#f08c82", fontSize: 13, margin: "6px 0 0" };

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "grid", gap: 16 }}>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-invalid={!!errors.email} />
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
