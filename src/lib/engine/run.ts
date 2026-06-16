import "server-only";
import { estimate, type EstimateInput } from "./estimator";
import { lookup, isAsyncNeed, type Need } from "./registry";
import { createJob, markJobDone, markJobFailed, setJobRequestId } from "./jobs";
import { reserveCredits, settleCredits, refundCredits } from "./credits";
import { runSync, submitAsync } from "./fal";
import { storeOutputFromUrl } from "./storage";

// Orchestration for the async job flow (Section 3.3).
//
// SYNC (image / try-on / edit): estimate -> create job -> RESERVE -> run fal -> store -> SETTLE.
//   On any failure after reserve, REFUND the reservation and mark the job failed.
//
// ASYNC (video): estimate -> create job -> RESERVE -> submit to fal with webhook URL.
//   The webhook route later stores the output and SETTLES. On submit failure, REFUND.

export interface RunInput {
  userId: string;
  userEmail?: string | null;
  need: Need;
  /** fal input arguments (reference image URLs, prompt, etc.). */
  falInput: Record<string, unknown>;
  /** Sizing for the estimate (count / seconds / megapixels). */
  estimateExtras?: Omit<EstimateInput, "need">;
}

// Best-effort extraction of the first output URL from a fal result payload.
export function firstOutputUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.images) && d.images[0] && typeof d.images[0] === "object") {
    const u = (d.images[0] as Record<string, unknown>).url;
    if (typeof u === "string") return u;
  }
  if (d.image && typeof d.image === "object") {
    const u = (d.image as Record<string, unknown>).url;
    if (typeof u === "string") return u;
  }
  if (d.video && typeof d.video === "object") {
    const u = (d.video as Record<string, unknown>).url;
    if (typeof u === "string") return u;
  }
  if (typeof d.url === "string") return d.url;
  return null;
}

export interface RunResult {
  jobId: string;
  status: "done" | "queued" | "failed";
  estimatedCredits: number;
  resultPath?: string;
  falRequestId?: string;
}

export async function runJob(input: RunInput): Promise<RunResult> {
  const est = estimate({ need: input.need, ...input.estimateExtras });
  const entry = lookup(input.need);

  // Create the job first so we have an id to attach ledger transactions to.
  const job = await createJob({
    userId: input.userId,
    userEmail: input.userEmail,
    type: input.need,
    payload: { falInput: input.falInput, estimate: est },
    estimatedCredits: est.credits,
  });

  // RESERVE at submit (gates on balance). If this throws, the job stays queued with no spend;
  // caller surfaces the insufficient-credits error.
  await reserveCredits(input.userId, est.credits, job.id, `reserve ${input.need}`);

  if (isAsyncNeed(input.need)) {
    // ASYNC: submit to fal with a webhook; the worker normally drives this, but submit here
    // when called inline. Settlement happens in the webhook route.
    try {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/fal-webhook`;
      const requestId = await submitAsync(entry.slug, input.falInput, webhookUrl);
      await setJobRequestId(job.id, requestId);
      return {
        jobId: job.id,
        status: "queued",
        estimatedCredits: est.credits,
        falRequestId: requestId,
      };
    } catch (err) {
      await refundCredits(input.userId, est.credits, job.id);
      await markJobFailed(job.id, String(err));
      return { jobId: job.id, status: "failed", estimatedCredits: est.credits };
    }
  }

  // SYNC: run to completion within the request.
  try {
    const { data, requestId } = await runSync(entry.slug, input.falInput);
    const url = firstOutputUrl(data);
    if (!url) throw new Error("fal returned no output URL");

    const ext = input.need.startsWith("video/") ? "mp4" : "png";
    const path = await storeOutputFromUrl(input.userId, job.id, url, ext);

    // Actual cost equals the estimate for fixed per-unit image models; settle the (zero) delta
    // so the ledger records a settle row and supports variable-cost models later.
    const actual = est.credits;
    await settleCredits(input.userId, est.credits, actual, job.id);
    await markJobDone(job.id, path, actual, requestId);

    return {
      jobId: job.id,
      status: "done",
      estimatedCredits: est.credits,
      resultPath: path,
      falRequestId: requestId,
    };
  } catch (err) {
    await refundCredits(input.userId, est.credits, job.id);
    await markJobFailed(job.id, String(err));
    return { jobId: job.id, status: "failed", estimatedCredits: est.credits };
  }
}
