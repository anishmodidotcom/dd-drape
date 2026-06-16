import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import type { JobRow } from "@/lib/engine/jobs";

// RLS-scoped reads for server components. These use the cookie-bound anon client, so a user can
// only ever read their own rows. No service-role key is involved.

export interface CreditTxn {
  id: string;
  kind: string;
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string;
  job_id: string | null;
}

export async function getBalance(): Promise<number> {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("drape_credit_balances")
    .select("balance")
    .maybeSingle();
  return (data?.balance as number) ?? 0;
}

export async function getTransactions(limit = 100): Promise<CreditTxn[]> {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("drape_credit_transactions")
    .select("id, kind, amount, balance_after, note, created_at, job_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as unknown as CreditTxn[]) ?? [];
}

export async function getJobs(limit = 60): Promise<JobRow[]> {
  const supabase = await getServerClient();
  const { data } = await supabase
    .from("drape_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as unknown as JobRow[]) ?? [];
}

export async function getJobById(id: string): Promise<JobRow | null> {
  const supabase = await getServerClient();
  const { data } = await supabase.from("drape_jobs").select("*").eq("id", id).maybeSingle();
  return (data as unknown as JobRow) ?? null;
}
