import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getJob } from "@/lib/engine/jobs";
import { reconcileOneJob } from "@/lib/engine/reconcile";

// POST /api/jobs/[id]/retry
// User-facing recovery for a stuck job: poll the provider and finalize, or refund + fail if it
// never started, so a stuck job is always recoverable without waiting on the worker.

export const runtime = "nodejs";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const job = await getJob(id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const result = await reconcileOneJob(job);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("retry failed", err);
    return NextResponse.json({ error: "retry_failed" }, { status: 500 });
  }
}
