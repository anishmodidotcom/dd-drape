import "server-only";
import { getAdminClient } from "@/lib/supabase/admin";
import { lookup, type Need } from "./registry";
import { getQueueStatus } from "./fal";
import { finalizeSuccess, finalizeFailure } from "./finalize";
import { firstOutputUrl } from "./run";
import type { JobRow } from "./jobs";

// Polling reconciler. Webhooks can be lost (this is exactly why v1 video jobs never completed).
// For jobs still in flight with a fal request id but no webhook after `minutes`, poll fal and
// finalize from whichever signal arrives first. Idempotent against a late webhook.

export interface ReconcileSummary {
  checked: number;
  completed: number;
  failed: number;
  pending: number;
}

export async function reconcileStaleJobs(minutes = 15): Promise<ReconcileSummary> {
  const admin = getAdminClient();
  const { data, error } = await admin.rpc("drape_list_stale_jobs", { p_minutes: minutes });
  if (error) throw new Error(`reconcile list failed: ${error.message}`);

  const jobs = (data as unknown as JobRow[]) ?? [];
  const summary: ReconcileSummary = { checked: jobs.length, completed: 0, failed: 0, pending: 0 };

  for (const job of jobs) {
    if (!job.fal_request_id) continue;
    const slug = lookup(job.type as Need).slug;
    const { status, data: result } = await getQueueStatus(slug, job.fal_request_id);

    if (status === "COMPLETED") {
      const url = firstOutputUrl(result);
      if (url) {
        await finalizeSuccess(job, url);
        summary.completed++;
      } else {
        await finalizeFailure(job, "reconcile: completed with no output url");
        summary.failed++;
      }
    } else if (status === "ERROR") {
      await finalizeFailure(job, "reconcile: fal reported an error / lost request");
      summary.failed++;
    } else {
      summary.pending++;
    }
  }
  return summary;
}

export interface ReconcileOneResult {
  status: "done" | "failed" | "pending" | "noop";
  message?: string;
}

// Reconcile a SINGLE job on demand (the user-facing retry affordance). The caller must have
// already verified ownership. Guarantees recoverability: a job that never got a fal request id
// (worker never picked it up) is failed + refunded so the user is never stranded or overcharged.
export async function reconcileOneJob(job: JobRow): Promise<ReconcileOneResult> {
  if (job.status === "done") return { status: "done" };
  if (job.status === "failed") return { status: "failed" };

  if (!job.fal_request_id) {
    await finalizeFailure(job, "reconcile: never started (no provider request); credits refunded");
    return { status: "failed", message: "That job never started, so we refunded your credits. You can try again." };
  }

  const slug = lookup(job.type as Need).slug;
  const { status, data } = await getQueueStatus(slug, job.fal_request_id);
  if (status === "COMPLETED") {
    const url = firstOutputUrl(data);
    if (url) {
      await finalizeSuccess(job, url);
      return { status: "done" };
    }
    await finalizeFailure(job, "reconcile: completed with no output; credits refunded");
    return { status: "failed", message: "The render finished without an image, so we refunded your credits." };
  }
  if (status === "ERROR") {
    await finalizeFailure(job, "reconcile: provider error / lost request; credits refunded");
    return { status: "failed", message: "The render failed, so we refunded your credits. You can try again." };
  }
  return { status: "pending", message: "Still rendering. Hang tight, it will update automatically." };
}
