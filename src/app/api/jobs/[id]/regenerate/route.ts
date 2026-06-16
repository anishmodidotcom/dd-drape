import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getJob } from "@/lib/engine/jobs";
import { runShot } from "@/lib/engine/run-shot";
import { InsufficientCreditsError } from "@/lib/engine/ledger";
import type { ShotSpec } from "@/lib/shot/spec";

// POST /api/jobs/[id]/regenerate
// Re-runs the same shot spec. Costs one generation (reserve/settle as normal).

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const job = await getJob(id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const spec = (job.payload?.meta as Record<string, unknown> | undefined)?.spec as
    | ShotSpec
    | undefined;
  if (!spec) {
    return NextResponse.json({ error: "no spec to regenerate" }, { status: 400 });
  }

  try {
    const result = await runShot(user.id, user.email ?? null, spec);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    return NextResponse.json({ error: "regenerate_failed" }, { status: 500 });
  }
}
