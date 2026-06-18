import { NextRequest, NextResponse } from "next/server";
import { reconcileStaleJobs } from "@/lib/engine/reconcile";

// POST /api/jobs/reconcile  (machine-to-machine: worker / cron)
// Finalizes in-flight jobs whose fal webhook never arrived. Gated by WORKER_SHARED_SECRET.
// Whitelisted in middleware so it is not bounced for having no login cookie.

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret = process.env.WORKER_SHARED_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || (auth !== `Bearer ${secret}` && req.headers.get("x-worker-secret") !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const minutes = Number(req.nextUrl.searchParams.get("minutes")) || 15;
  try {
    const summary = await reconcileStaleJobs(minutes);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("reconcile failed", err);
    return NextResponse.json({ error: "reconcile_failed" }, { status: 500 });
  }
}
