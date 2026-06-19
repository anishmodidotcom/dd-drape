import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerClient } from "@/lib/supabase/server";

// Email-confirmation landing. The confirmation link in the signup email redirects here (set via
// emailRedirectTo at signUp). We complete the PKCE code exchange (or a token-hash OTP, if the
// dashboard email template uses that form), which establishes the session via auth cookies, then
// send the user to a branded /welcome screen. We never leave the user on a dead page: any failure
// still lands on /welcome with a graceful, reassuring state.

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await getServerClient();
  let ok = false;
  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      ok = !error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      ok = !error;
    }
  } catch {
    ok = false;
  }

  // Relative to the request so it works on any deployment host. Cookies set by the exchange ride
  // along on the redirect response.
  return NextResponse.redirect(new URL(ok ? "/welcome" : "/welcome?error=1", req.url));
}
