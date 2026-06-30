import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { isAdminEmail, adminEmails, validateAdjustInput, MAX_ADJUST } from "@/lib/admin/allowlist";

afterEach(() => { delete process.env.ADMIN_EMAILS; });

describe("admin allowlist (the server-side gate predicate)", () => {
  it("the founder email is a built-in admin, case-insensitive", () => {
    expect(isAdminEmail("anish.modi@deeperdesigns.in")).toBe(true);
    expect(isAdminEmail("Anish.Modi@DeeperDesigns.in")).toBe(true);
  });
  it("a normal user is NOT an admin", () => {
    expect(isAdminEmail("someone@gmail.com")).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
  it("more admins can be added via the ADMIN_EMAILS env, comma separated", () => {
    process.env.ADMIN_EMAILS = "ops@oviya.studio, second@oviya.studio";
    expect(isAdminEmail("ops@oviya.studio")).toBe(true);
    expect(isAdminEmail("second@oviya.studio")).toBe(true);
    expect(adminEmails()).toContain("anish.modi@deeperdesigns.in"); // builtin still present
    expect(isAdminEmail("nope@oviya.studio")).toBe(false);
  });
});

describe("admin credit adjust validation (grant + revoke)", () => {
  const uid = "11111111-1111-1111-1111-111111111111";
  it("accepts a positive grant", () => {
    const r = validateAdjustInput({ userId: uid, amount: 500, reason: "goodwill" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.amount).toBe(500);
  });
  it("accepts a negative revoke", () => {
    const r = validateAdjustInput({ userId: uid, amount: -200, reason: "chargeback" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.amount).toBe(-200);
  });
  it("rejects zero, non-integer, missing reason, bad user, and out-of-range", () => {
    expect(validateAdjustInput({ userId: uid, amount: 0, reason: "x" }).ok).toBe(false);
    expect(validateAdjustInput({ userId: uid, amount: 1.5, reason: "x" }).ok).toBe(false);
    expect(validateAdjustInput({ userId: uid, amount: 100, reason: "" }).ok).toBe(false);
    expect(validateAdjustInput({ userId: "x", amount: 100, reason: "y" }).ok).toBe(false);
    expect(validateAdjustInput({ userId: uid, amount: MAX_ADJUST + 1, reason: "y" }).ok).toBe(false);
  });
});

describe("migration 0006 guarantees (idempotent grant + locked-down privileged functions)", () => {
  const sql = readFileSync("supabase/migrations/0006_drape_admin.sql", "utf8");
  it("the signup grant is idempotent (guarded by an existing signup_grant check)", () => {
    expect(sql).toMatch(/if not exists[\s\S]*signup_grant[\s\S]*drape_grant_credits/);
  });
  it("adds the 'adjust' ledger kind", () => {
    expect(sql).toContain("'adjust'");
  });
  it("the admin adjust + audit are service_role only (revoked from public)", () => {
    expect(sql).toMatch(/revoke all on function public\.drape_admin_adjust.*from public/);
    expect(sql).toMatch(/grant execute on function public\.drape_admin_adjust.*to service_role/);
    expect(sql).toMatch(/drape_admin_actions[\s\S]*enable row level security/);
  });
});
