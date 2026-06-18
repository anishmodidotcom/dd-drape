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
