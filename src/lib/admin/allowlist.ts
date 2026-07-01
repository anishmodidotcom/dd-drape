// Superadmin allowlist + input validation. Pure (no server-only) so it is unit-testable. The
// allowlist is the founder's email built in, extensible via the ADMIN_EMAILS env var (comma
// separated). This is read SERVER-SIDE only (by src/lib/admin/auth.ts); it is never a client check.

// Built-in superadmins on the oviyastudio.com domain (Anish controls this domain). Add any other
// login email via the ADMIN_EMAILS env var. No external domains are hardcoded.
const BUILTIN_ADMINS = ["support@oviyastudio.com", "admin@oviyastudio.com"];

export function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...BUILTIN_ADMINS.map((e) => e.toLowerCase()), ...fromEnv]));
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

// Bounds on a single admin credit adjustment, so a fat-finger cannot move millions of credits.
export const MAX_ADJUST = 1_000_000;

export interface AdjustInput {
  userId: string;
  amount: number; // signed: >0 grant, <0 revoke
  reason: string;
}
export type AdjustValidation = { ok: true; value: AdjustInput } | { ok: false; error: string };

export function validateAdjustInput(body: unknown): AdjustValidation {
  const b = (body ?? {}) as Record<string, unknown>;
  const userId = typeof b.userId === "string" ? b.userId.trim() : "";
  const amount = typeof b.amount === "number" ? b.amount : Number(b.amount);
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";

  if (!userId || !/^[0-9a-fA-F-]{10,}$/.test(userId)) return { ok: false, error: "A valid user is required." };
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount === 0) {
    return { ok: false, error: "Amount must be a non-zero whole number." };
  }
  if (Math.abs(amount) > MAX_ADJUST) return { ok: false, error: `Amount is out of range (max ${MAX_ADJUST}).` };
  if (!reason) return { ok: false, error: "A reason is required for the audit log." };

  return { ok: true, value: { userId, amount, reason } };
}
