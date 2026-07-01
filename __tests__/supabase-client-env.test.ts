import { describe, it, expect } from "vitest";
import { validateSupabaseEnv } from "@/lib/supabase/client";

// The real bug: a signup submit that throws synchronously before any network request fires. Root
// cause traced to @supabase/supabase-js's SupabaseClient constructor validating its URL eagerly and
// throwing before a single request is made. validateSupabaseEnv is the pure guard extracted from
// getBrowserClient so this exact failure mode (missing vs malformed NEXT_PUBLIC_* values, including
// the classic "value looks right in the dashboard but the deployed bundle predates it" class of bug)
// is diagnosable and unit-testable, independent of any live browser/network environment.
describe("validateSupabaseEnv (the real signup throw, made diagnosable)", () => {
  it("accepts a well-formed URL and key", () => {
    const r = validateSupabaseEnv("https://ruyfnoezzrdqlyhxrxbx.supabase.co", "anon-key-123");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url).toBe("https://ruyfnoezzrdqlyhxrxbx.supabase.co");
      expect(r.anonKey).toBe("anon-key-123");
    }
  });

  it("reports a missing URL distinctly from a missing key", () => {
    const noUrl = validateSupabaseEnv(undefined, "anon-key");
    expect(noUrl.ok).toBe(false);
    if (!noUrl.ok) expect(noUrl.issue).toEqual({ variable: "NEXT_PUBLIC_SUPABASE_URL", reason: "missing" });

    const noKey = validateSupabaseEnv("https://x.supabase.co", undefined);
    expect(noKey.ok).toBe(false);
    if (!noKey.ok) expect(noKey.issue).toEqual({ variable: "NEXT_PUBLIC_SUPABASE_ANON_KEY", reason: "missing" });
  });

  it("an empty string is treated as missing, not a valid empty value", () => {
    const r = validateSupabaseEnv("", "");
    expect(r.ok).toBe(false);
  });

  it("rejects a URL with no scheme (the exact throw fal-ai/supabase-js raises synchronously)", () => {
    const r = validateSupabaseEnv("ruyfnoezzrdqlyhxrxbx.supabase.co", "anon-key");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issue).toEqual({ variable: "NEXT_PUBLIC_SUPABASE_URL", reason: "malformed_url" });
  });

  it("rejects a completely unparseable URL", () => {
    const r = validateSupabaseEnv("not a url at all", "anon-key");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issue.reason).toBe("malformed_url");
  });

  it("cleans a literal wrapping-quote paste mistake (a real dashboard copy/paste failure mode)", () => {
    const r = validateSupabaseEnv('"https://ruyfnoezzrdqlyhxrxbx.supabase.co"', '"anon-key-123"');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url).toBe("https://ruyfnoezzrdqlyhxrxbx.supabase.co");
      expect(r.anonKey).toBe("anon-key-123");
    }
  });

  it("cleans leading/trailing whitespace and a stray trailing newline", () => {
    const r = validateSupabaseEnv("  https://ruyfnoezzrdqlyhxrxbx.supabase.co\n", "  anon-key-123\n");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url).toBe("https://ruyfnoezzrdqlyhxrxbx.supabase.co");
      expect(r.anonKey).toBe("anon-key-123");
    }
  });
});
