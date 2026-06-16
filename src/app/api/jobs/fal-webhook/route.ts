import { NextRequest, NextResponse } from "next/server";
import { checkSharedSecret, verifyFalSignature } from "@/lib/engine/fal-webhook";
import { getJobByRequestId, markJobDone, markJobFailed } from "@/lib/engine/jobs";
import { settleCredits, refundCredits } from "@/lib/engine/credits";
import { storeOutputFromUrl, storeManifest } from "@/lib/engine/storage";
import { firstOutputUrl } from "@/lib/engine/run";
import { lookup, type Need } from "@/lib/engine/registry";
import { buildProvenanceManifest } from "@/lib/shot/provenance";

// POST /api/jobs/fal-webhook
// fal posts the result of an async (video) job here. This route is whitelisted in middleware
// (layer 1) so the machine-to-machine POST is not bounced for having no login cookie, and it
// verifies the signature (layer 2) before settling credits and storing the output.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Layer 2a: shared-secret gate (active until ED25519 confirmed on a real delivery).
  if (!checkSharedSecret(req.headers)) {
    return NextResponse.json({ error: "bad secret" }, { status: 401 });
  }

  // Layer 2b: ED25519 signature verification.
  const verified = await verifyFalSignature({ headers: req.headers, rawBody });
  if (!verified.ok) {
    console.warn("fal webhook signature rejected:", verified.reason);
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: {
    request_id?: string;
    status?: string;
    payload?: unknown;
    error?: unknown;
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const requestId = payload.request_id ?? verified.requestId;
  if (!requestId) {
    return NextResponse.json({ error: "no request id" }, { status: 400 });
  }

  const job = await getJobByRequestId(requestId);
  if (!job) {
    // Unknown request id: ack with 200 so fal does not retry forever, but record nothing.
    return NextResponse.json({ ok: true, note: "no matching job" });
  }

  // Idempotency: if already settled, ack.
  if (job.status === "done" || job.status === "failed") {
    return NextResponse.json({ ok: true, note: "already settled" });
  }

  const ok = payload.status ? /ok|completed|success/i.test(payload.status) : !payload.error;

  if (!ok) {
    await refundCredits(job.user_id, job.estimated_credits, job.id);
    await markJobFailed(job.id, `fal job failed: ${JSON.stringify(payload.error ?? payload.status)}`);
    return NextResponse.json({ ok: true, settled: "refunded" });
  }

  try {
    const url = firstOutputUrl(payload.payload);
    if (!url) throw new Error("webhook payload has no output url");
    const ext = job.type.startsWith("video/") ? "mp4" : "png";
    const path = await storeOutputFromUrl(job.user_id, job.id, url, ext);

    // Provenance sidecar for the video output.
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

    // Fixed per-second cost: actual equals the estimate. Settle the delta (zero today; supports
    // variable-cost models later) and mark done.
    const actual = job.estimated_credits;
    await settleCredits(job.user_id, job.estimated_credits, actual, job.id);
    await markJobDone(job.id, path, actual, requestId);
    return NextResponse.json({ ok: true, settled: "done" });
  } catch (err) {
    await refundCredits(job.user_id, job.estimated_credits, job.id);
    await markJobFailed(job.id, `webhook handling failed: ${String(err)}`);
    return NextResponse.json({ ok: true, settled: "refunded-on-error" });
  }
}
