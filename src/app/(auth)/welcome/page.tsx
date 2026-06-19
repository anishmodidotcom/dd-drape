import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Wordmark } from "@/components/ui/Wordmark";
import { ResendConfirm } from "@/components/ResendConfirm";

export const metadata = { title: "Welcome. Oviya Studio." };

// The branded landing after an email-confirmation link. Three session-aware states, none of them a
// dead page:
//  - confirmed AND signed in    -> warm success, straight into the studio
//  - confirmed, not signed in   -> success, sign in to continue (e.g. confirmed on another device)
//  - link could not be verified -> graceful error with resend + sign in
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await getUser();

  return (
    <>
      <Link href="/" style={{ display: "inline-block", marginBottom: 24 }}>
        <Wordmark size="sm" />
      </Link>

      {user ? (
        <>
          <p className="eyebrow accent" style={{ marginBottom: 10 }}>Confirmed</p>
          <h1 style={{ fontSize: 34, color: "var(--porcelain)", marginBottom: 10 }}>Welcome to Oviya Studio</h1>
          <p className="muted" style={{ marginBottom: 28 }}>
            Your email is confirmed and you are signed in. The set is ready. Your product stays the anchor for every shoot.
          </p>
          <Link href="/app/new" className="btn btn-primary btn-block">Enter the Studio</Link>
        </>
      ) : error ? (
        <>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Confirmation</p>
          <h1 style={{ fontSize: 32, color: "var(--porcelain)", marginBottom: 10 }}>Let us try that again</h1>
          <p className="muted" style={{ marginBottom: 20 }}>
            That confirmation link could not be verified in this browser. If you already confirmed, you can sign in now. Otherwise, send yourself a fresh link.
          </p>
          <div style={{ display: "grid", gap: 18 }}>
            <Link href="/login" className="btn btn-primary btn-block">Sign in</Link>
            <ResendConfirm />
          </div>
        </>
      ) : (
        <>
          <p className="eyebrow accent" style={{ marginBottom: 10 }}>Confirmed</p>
          <h1 style={{ fontSize: 34, color: "var(--porcelain)", marginBottom: 10 }}>Your email is confirmed</h1>
          <p className="muted" style={{ marginBottom: 28 }}>
            Sign in to step on set and start your first shoot.
          </p>
          <Link href="/login?confirmed=1" className="btn btn-primary btn-block">Sign in</Link>
        </>
      )}
    </>
  );
}
