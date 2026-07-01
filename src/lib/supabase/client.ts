"use client";
import { createBrowserClient } from "@supabase/ssr";

// Browser client. Uses the public anon key only. RLS restricts every read to the
// signed-in user's own rows. The service-role key is NEVER exposed here.
//
// IMPORTANT: NEXT_PUBLIC_* values are inlined into the CLIENT BUNDLE AT BUILD TIME, not read live
// from the hosting dashboard in the browser. If a value is only correct in the dashboard but the
// currently-served bundle was built before that change (a "Redeploy" does not always force a fresh
// build), the browser is still running the OLD or blank value even though the dashboard looks right.
// This is the real root cause behind a signup that throws before any network request fires: the
// underlying Supabase client library validates its URL SYNCHRONOUSLY in its constructor and throws
// immediately on anything missing or malformed, before a single request is made.
//
// validateSupabaseEnv is pure (no browser/client APIs) so it is unit-testable, and it distinguishes
// "missing" from "present but malformed" so the real cause is diagnosable instead of an opaque throw.

function clean(value: string | undefined): string {
  if (!value) return "";
  // Defensive against the most common copy/paste mistakes when setting a hosting-dashboard env var:
  // literal surrounding quotes pasted in as part of the value, and leading/trailing whitespace or a
  // stray newline.
  return value.trim().replace(/^['"]+|['"]+$/g, "").trim();
}

export type SupabaseEnvVar = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";
export interface SupabaseEnvIssue {
  variable: SupabaseEnvVar;
  reason: "missing" | "malformed_url";
}
export type SupabaseEnvResult =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; issue: SupabaseEnvIssue };

/** Pure validation of the two public env values. No I/O, no browser API: safe to unit test. */
export function validateSupabaseEnv(
  rawUrl: string | undefined,
  rawAnonKey: string | undefined
): SupabaseEnvResult {
  const url = clean(rawUrl);
  const anonKey = clean(rawAnonKey);
  if (!url) return { ok: false, issue: { variable: "NEXT_PUBLIC_SUPABASE_URL", reason: "missing" } };
  if (!anonKey) return { ok: false, issue: { variable: "NEXT_PUBLIC_SUPABASE_ANON_KEY", reason: "missing" } };
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, issue: { variable: "NEXT_PUBLIC_SUPABASE_URL", reason: "malformed_url" } };
  }
  try {
    new URL(url);
  } catch {
    return { ok: false, issue: { variable: "NEXT_PUBLIC_SUPABASE_URL", reason: "malformed_url" } };
  }
  return { ok: true, url, anonKey };
}

export function getBrowserClient() {
  const result = validateSupabaseEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!result.ok) {
    // Loud, specific, developer-facing breadcrumb. Never shown to the user (the caller maps any
    // thrown error to calm copy via authMessage); this is the one piece of information that
    // pinpoints WHICH value is wrong and WHY, instead of a swallowed generic failure.
    console.error(
      `[oviya] Supabase client init failed: ${result.issue.variable} is ${result.issue.reason}. ` +
        "If this value looks correct in the hosting dashboard, the deployed bundle likely predates " +
        "that change: NEXT_PUBLIC_* values are baked into the browser bundle at build time, so a " +
        "fresh production build is required after changing them, not just a redeploy of the existing " +
        "build artifact."
    );
    // Brand-clean, no vendor name, no spaces: authMessage() falls this through to the calm generic
    // message rather than ever showing it verbatim to a user.
    throw new Error("client_config_error");
  }
  return createBrowserClient(result.url, result.anonKey);
}
