import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { Need } from "./registry";

// Job records: create, transition, and store results. Writes go through the service-role
// admin client; clients only read their own jobs via RLS.

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobRow {
  id: string;
  tenant_id: string;
  user_id: string;
  user_email: string | null;
  type: string;
  provider: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  estimated_credits: number;
  actual_credits: number | null;
  attempts: number;
  last_error: string | null;
  result_ref: string | null;
  fal_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJobInput {
  userId: string;
  userEmail?: string | null;
  type: Need;
  payload: Record<string, unknown>;
  estimatedCredits: number;
}

export async function createJob(input: CreateJobInput): Promise<JobRow> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("jobs")
    .insert({
      tenant_id: input.userId, // tenant defaults to user today; room for orgs later
      user_id: input.userId,
      user_email: input.userEmail ?? null,
      type: input.type,
      provider: "fal",
      payload: input.payload as Json,
      status: "queued",
      estimated_credits: input.estimatedCredits,
    })
    .select("*")
    .single();
  if (error) throw new Error(`createJob failed: ${error.message}`);
  return data as unknown as JobRow;
}

export async function markJobDone(
  jobId: string,
  resultRef: string,
  actualCredits: number,
  falRequestId?: string
) {
  const admin = getAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({
      status: "done",
      result_ref: resultRef,
      actual_credits: actualCredits,
      fal_request_id: falRequestId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) throw new Error(`markJobDone failed: ${error.message}`);
}

export async function markJobFailed(jobId: string, lastError: string) {
  const admin = getAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({
      status: "failed",
      last_error: lastError.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) throw new Error(`markJobFailed failed: ${error.message}`);
}

export async function setJobRequestId(jobId: string, falRequestId: string) {
  const admin = getAdminClient();
  const { error } = await admin
    .from("jobs")
    .update({ fal_request_id: falRequestId, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw new Error(`setJobRequestId failed: ${error.message}`);
}

export async function getJobByRequestId(falRequestId: string): Promise<JobRow | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("jobs")
    .select("*")
    .eq("fal_request_id", falRequestId)
    .maybeSingle();
  if (error) throw new Error(`getJobByRequestId failed: ${error.message}`);
  return (data as unknown as JobRow) ?? null;
}

export async function getJob(jobId: string): Promise<JobRow | null> {
  const admin = getAdminClient();
  const { data, error } = await admin.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw new Error(`getJob failed: ${error.message}`);
  return (data as unknown as JobRow) ?? null;
}
