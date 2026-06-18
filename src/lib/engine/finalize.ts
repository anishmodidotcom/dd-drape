import "server-only";
import { lookup, type Need } from "./registry";
import { markJobDone, markJobFailed, type JobRow } from "./jobs";
import { settleCredits, refundCredits } from "./credits";
import { storeOutputFromUrl, storeManifest } from "./storage";
import { buildProvenanceManifest } from "@/lib/shot/provenance";

// Shared job finalization for the async path. Called by BOTH the fal webhook and the polling
// reconciler, so whichever signal arrives first completes the job. Idempotent: the ledger
// functions are idempotent per (job, kind) and we early-return on already-settled jobs, so a
// webhook racing the reconciler is safe.

export async function finalizeSuccess(job: JobRow, outputUrl: string): Promise<void> {
  if (job.status === "done" || job.status === "failed") return;

  const ext = job.type.startsWith("video/") ? "mp4" : "png";
  const path = await storeOutputFromUrl(job.user_id, job.id, outputUrl, ext);

  const meta = (job.payload?.meta ?? {}) as Record<string, unknown>;
  await storeManifest(
    job.user_id,
    job.id,
    buildProvenanceManifest({
      jobId: job.id,
      modelSlug: lookup(job.type as Need).slug,
      need: job.type,
      category: String(meta.category ?? "apparel"),
      subType: String(meta.subType ?? ""),
      tier: job.tier,
      outputFormat: ext === "mp4" ? "video/mp4" : "image/png",
    })
  ).catch(() => undefined);

  // Fixed per-unit cost: actual equals the estimate. Idempotent settle.
  const actual = job.estimated_credits;
  await settleCredits(job.user_id, job.estimated_credits, actual, job.id);
  await markJobDone(job.id, path, actual, job.fal_request_id ?? undefined);
}

export async function finalizeFailure(job: JobRow, reason: string): Promise<void> {
  if (job.status === "done" || job.status === "failed") return;
  // Idempotent refund (no-op if already refunded).
  await refundCredits(job.user_id, job.estimated_credits, job.id);
  await markJobFailed(job.id, reason.slice(0, 2000));
}
