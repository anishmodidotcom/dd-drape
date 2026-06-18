import "server-only";
import { estimate, type EstimateInput } from "./estimator";
import { lookup, isAsyncNeed, type Need } from "./registry";
import { createJob, markJobDone, markJobFailed, type Tier, type QcStatus } from "./jobs";
import { reserveCredits, settleCredits, refundCredits } from "./credits";
import { runSync } from "./fal";
import { storeOutputFromUrl, storeManifest, signedUrl } from "./storage";
import { buildProvenanceManifest } from "@/lib/shot/provenance";
import { directorEnabled } from "@/lib/director/client";
import { checkFidelity } from "@/lib/director/gate";

// Orchestration for the async job flow (Section 3.3).
//
// SYNC (image / try-on / edit): estimate -> create job -> RESERVE -> run fal -> store -> SETTLE.
//   On any failure after reserve, REFUND the reservation and mark the job failed.
// ASYNC (video): estimate -> create job -> RESERVE -> submit to fal with webhook URL.
//   The webhook route later stores the output and SETTLES. On submit failure, REFUND.
// RED BLOCK: create job -> RESERVE -> immediately REFUND -> mark failed with a clear message.
//   No silent dead-ends: the reservation is always returned and the UI shows why.

export const RED_BLOCK_PREFIX = "RED_BLOCK: ";

export interface RunInput {
  userId: string;
  userEmail?: string | null;
  need: Need;
  falInput: Record<string, unknown>;
  estimateExtras?: Omit<EstimateInput, "need">;
  tier?: Tier | null;
  qcStatus?: QcStatus;
  parentJobId?: string | null;
  /** When set, do not generate: reserve, refund, and surface this message (RED block). */
  blocked?: string;
  /** Extra metadata stored on the job payload (shot spec summary, reference paths, etc.). */
  meta?: Record<string, unknown>;
  /** Post-generation fidelity gate: compares source product vs output, refunds on a non-match. */
  fidelityGate?: { sourceUrl: string };
}

export const FIDELITY_FAIL_PREFIX = "FIDELITY_FAIL: ";

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

export type RunStatus = "done" | "queued" | "failed" | "blocked";

export interface RunResult {
  jobId: string;
  status: RunStatus;
  tier?: Tier | null;
  qcStatus?: QcStatus;
  estimatedCredits: number;
  resultPath?: string;
  falRequestId?: string;
  message?: string;
}

export async function runJob(input: RunInput): Promise<RunResult> {
  const est = estimate({ need: input.need, ...input.estimateExtras });
  const entry = lookup(input.need);
  const qcStatus: QcStatus = input.qcStatus ?? "none";

  const job = await createJob({
    userId: input.userId,
    userEmail: input.userEmail,
    type: input.need,
    payload: { falInput: input.falInput, estimate: est, meta: input.meta ?? {} },
    estimatedCredits: est.credits,
    tier: input.tier ?? null,
    qcStatus,
    parentJobId: input.parentJobId ?? null,
  });

  // RESERVE at submit (gates on balance). Throws InsufficientCreditsError if unaffordable.
  await reserveCredits(input.userId, est.credits, job.id, `reserve ${input.need}`);

  // RED block: nothing is generated. Refund the reservation and surface a clear message.
  if (input.blocked) {
    await refundCredits(input.userId, est.credits, job.id);
    await markJobFailed(job.id, `${RED_BLOCK_PREFIX}${input.blocked}`);
    return {
      jobId: job.id,
      status: "blocked",
      tier: input.tier,
      estimatedCredits: est.credits,
      message: input.blocked,
    };
  }

  if (isAsyncNeed(input.need)) {
    // ASYNC (video): the job is reserved and left queued. The Railway worker claims it
    // atomically and submits it to fal with the webhook URL; the webhook settles credits.
    // We intentionally do NOT submit inline here, so the worker is the single submitter and
    // there is no double-processing.
    void entry; // slug is used by the worker, not here
    return {
      jobId: job.id,
      status: "queued",
      tier: input.tier,
      qcStatus,
      estimatedCredits: est.credits,
    };
  }

  // SYNC: run to completion within the request.
  try {
    const { data, requestId } = await runSync(entry.slug, input.falInput);
    const url = firstOutputUrl(data);
    if (!url) throw new Error("fal returned no output URL");

    const ext = input.need.startsWith("video/") ? "mp4" : "png";
    const path = await storeOutputFromUrl(input.userId, job.id, url, ext);

    // FIDELITY GATE (v2 trust backbone): compare the source product against the output. On a
    // non-match, refund and fail with a clear message rather than shipping a drifted product.
    if (input.fidelityGate && directorEnabled() && !input.need.startsWith("video/")) {
      try {
        const outUrl = await signedUrl(path, 600);
        const verdict = await checkFidelity(input.fidelityGate.sourceUrl, outUrl);
        if (!verdict.match) {
          await refundCredits(input.userId, est.credits, job.id);
          await markJobFailed(
            job.id,
            `${FIDELITY_FAIL_PREFIX}${verdict.reasons.join("; ") || "product drifted from the source"}`
          );
          return {
            jobId: job.id,
            status: "failed",
            tier: input.tier,
            estimatedCredits: est.credits,
            message:
              "We caught a fidelity drift between the result and your product, so we did not deliver it. Your credits were refunded.",
          };
        }
      } catch {
        // Gate failure should not strand a good generation; proceed without blocking.
      }
    }

    // Provenance (Section 10): write a C2PA-style manifest sidecar for every output.
    const meta = input.meta ?? {};
    await storeManifest(
      input.userId,
      job.id,
      buildProvenanceManifest({
        jobId: job.id,
        modelSlug: entry.slug,
        need: input.need,
        category: String(meta.category ?? "apparel"),
        subType: String(meta.subType ?? ""),
        tier: input.tier ?? null,
        outputFormat: ext === "mp4" ? "video/mp4" : "image/png",
      })
    ).catch(() => undefined);

    const actual = est.credits; // fixed per-unit cost; settle records the (zero) delta
    await settleCredits(input.userId, est.credits, actual, job.id);
    await markJobDone(job.id, path, actual, requestId);

    return {
      jobId: job.id,
      status: "done",
      tier: input.tier,
      qcStatus,
      estimatedCredits: est.credits,
      resultPath: path,
      falRequestId: requestId,
    };
  } catch (err) {
    await refundCredits(input.userId, est.credits, job.id);
    await markJobFailed(job.id, String(err));
    return {
      jobId: job.id,
      status: "failed",
      estimatedCredits: est.credits,
      message: "Generation failed. Your credits were refunded.",
    };
  }
}
