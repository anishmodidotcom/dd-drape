import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getJob } from "@/lib/engine/jobs";
import { RED_BLOCK_PREFIX, FIDELITY_FAIL_PREFIX } from "@/lib/engine/run";

// Turn an internal last_error into a clean, human failure reason (no codes / vendor names).
function humanFailure(lastError: string | null): string {
  if (!lastError) return "Something went wrong while generating this shot.";
  if (lastError.startsWith(FIDELITY_FAIL_PREFIX)) {
    return "We caught a drift between the result and your product, so we did not deliver it.";
  }
  if (/insufficient/i.test(lastError)) return "There were not enough credits to complete this.";
  if (/no output|no image|timeout|provider|fal|render/i.test(lastError)) {
    return "The render did not complete.";
  }
  return "Something went wrong while generating this shot.";
}

// GET /api/jobs/[id]
// Returns the job's live status plus short-lived signed URLs for the result and the original
// product image (for before/after). Ownership is enforced explicitly.

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const job = await getJob(id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const meta = (job.payload?.meta ?? {}) as Record<string, unknown>;
  const refPaths = (meta.referenceImagePaths as string[] | undefined) ?? [];

  const blocked = job.last_error?.startsWith(RED_BLOCK_PREFIX)
    ? job.last_error.slice(RED_BLOCK_PREFIX.length)
    : null;

  // Audit item 5: return the storage PATHS, so the client renders them via SmartImage and the
  // signed URL auto-refreshes on expiry (previews never break on a long-open page).
  return NextResponse.json({
    id: job.id,
    type: job.type,
    status: job.status,
    tier: job.tier,
    qcStatus: job.qc_status,
    fidelity: (meta.fidelity as string | undefined) ?? null,
    estimatedCredits: job.estimated_credits,
    actualCredits: job.actual_credits,
    resultPath: job.result_ref,
    beforePath: refPaths[0] ?? null,
    blocked,
    failed: job.status === "failed" && !blocked,
    failureReason: job.status === "failed" && !blocked ? humanFailure(job.last_error) : null,
    refunded: job.status === "failed", // failure + RED block both refund
    aiLabel: (meta.aiLabel as boolean | undefined) ?? true,
    format: (meta.format as string | null | undefined) ?? null,
    category: (meta.category as string | undefined) ?? null,
    parentJobId: job.parent_job_id,
    createdAt: job.created_at,
  });
}
