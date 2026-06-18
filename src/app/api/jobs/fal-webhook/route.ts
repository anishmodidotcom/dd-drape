import { NextRequest, NextResponse } from "next/server";
import { checkSharedSecret, verifyFalSignature } from "@/lib/engine/fal-webhook";
import { getJobByRequestId } from "@/lib/engine/jobs";
import { finalizeSuccess, finalizeFailure } from "@/lib/engine/finalize";
import { firstOutputUrl } from "@/lib/engine/run";

// POST /api/jobs/fal-webhook
// fal posts the result of an async (video) job here. Whitelisted in middleware (layer 1) so the
// machine-to-machine POST is not bounced for having no login cookie; verifies the signature
// (layer 2). Idempotent on fal request_id and via the idempotent ledger, so fal's retries (up to
// 10x over 2h) and a racing reconciler are all safe.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!checkSharedSecret(req.headers)) {
    return NextResponse.json({ error: "bad secret" }, { status: 401 });
  }
  const verified = await verifyFalSignature({ headers: req.headers, rawBody });
  if (!verified.ok) {
    console.warn("fal webhook signature rejected:", verified.reason);
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: { request_id?: string; status?: string; payload?: unknown; error?: unknown };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const requestId = payload.request_id ?? verified.requestId;
  if (!requestId) return NextResponse.json({ error: "no request id" }, { status: 400 });

  const job = await getJobByRequestId(requestId);
  if (!job) return NextResponse.json({ ok: true, note: "no matching job" });
  if (job.status === "done" || job.status === "failed") {
    return NextResponse.json({ ok: true, note: "already settled" });
  }

  const ok = payload.status ? /ok|completed|success/i.test(payload.status) : !payload.error;
  if (!ok) {
    await finalizeFailure(
      job,
      `fal job failed: ${JSON.stringify(payload.error ?? payload.status)}`
    );
    return NextResponse.json({ ok: true, settled: "refunded" });
  }

  try {
    const url = firstOutputUrl(payload.payload);
    if (!url) throw new Error("webhook payload has no output url");
    await finalizeSuccess(job, url);
    return NextResponse.json({ ok: true, settled: "done" });
  } catch (err) {
    await finalizeFailure(job, `webhook handling failed: ${String(err)}`);
    return NextResponse.json({ ok: true, settled: "refunded-on-error" });
  }
}
