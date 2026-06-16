import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { InsufficientCreditsError } from "./ledger";

// Server-side credit lifecycle. Wraps the SECURITY DEFINER Postgres functions.
//
// VERIFY FUNCTION SIGNATURES (rule 9). These RPC calls MUST match the SQL in
// supabase/migrations/0001_init.sql exactly, arg name + type + count:
//   grant_credits(p_user_id uuid, p_amount bigint, p_note text)
//   debit_credits(p_user_id uuid, p_amount bigint, p_job_id uuid, p_kind text, p_gate boolean, p_note text)

export async function grantCredits(userId: string, amount: number, note?: string) {
  const admin = getAdminClient();
  const { data, error } = await admin.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_note: note ?? null,
  });
  if (error) throw new Error(`grant_credits failed: ${error.message}`);
  return data as number;
}

/** RESERVE at submit: debit estimated credits, gated on balance. Throws if insufficient. */
export async function reserveCredits(
  userId: string,
  estimated: number,
  jobId: string,
  note?: string
) {
  const admin = getAdminClient();
  const { data, error } = await admin.rpc("debit_credits", {
    p_user_id: userId,
    p_amount: estimated,
    p_job_id: jobId,
    p_kind: "reserve",
    p_gate: true,
    p_note: note ?? "reserve",
  });
  if (error) {
    if (/insufficient_credits/.test(error.message)) {
      throw new InsufficientCreditsError(0, estimated);
    }
    throw new Error(`reserve failed: ${error.message}`);
  }
  return data as number;
}

/** SETTLE the delta at completion: charge (actual - estimated); negative credits part back. */
export async function settleCredits(
  userId: string,
  estimated: number,
  actual: number,
  jobId: string
) {
  const admin = getAdminClient();
  const delta = actual - estimated;
  const { data, error } = await admin.rpc("debit_credits", {
    p_user_id: userId,
    p_amount: delta,
    p_job_id: jobId,
    p_kind: "settle",
    p_gate: false,
    p_note: `settle est=${estimated} act=${actual}`,
  });
  if (error) throw new Error(`settle failed: ${error.message}`);
  return data as number;
}

/** REFUND on failure: credit the full reserved amount back (nothing was spent). */
export async function refundCredits(userId: string, reserved: number, jobId: string) {
  const admin = getAdminClient();
  const { data, error } = await admin.rpc("debit_credits", {
    p_user_id: userId,
    p_amount: -reserved, // negative debit = credit back
    p_job_id: jobId,
    p_kind: "refund",
    p_gate: false,
    p_note: "refund on failure",
  });
  if (error) throw new Error(`refund failed: ${error.message}`);
  return data as number;
}
