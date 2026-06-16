import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getJob, setJobQcStatus } from "@/lib/engine/jobs";

// POST /api/jobs/[id]/qc  { action: "approve" }
// AMBER QC gate: user approves the reviewed output.

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const job = await getJob(id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (body.action !== "approve") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  await setJobQcStatus(id, "approved");
  return NextResponse.json({ ok: true, qcStatus: "approved" });
}
