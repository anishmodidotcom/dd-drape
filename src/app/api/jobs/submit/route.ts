import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { runJob } from "@/lib/engine/run";
import { InsufficientCreditsError } from "@/lib/engine/ledger";
import { REGISTRY, type Need } from "@/lib/engine/registry";

// POST /api/jobs/submit
// Body: { need, falInput, estimateExtras? }
// Validates auth, reserves credits, runs (sync) or queues (async) the job.

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel cap for sync image/try-on/edit jobs

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    need?: Need;
    falInput?: Record<string, unknown>;
    estimateExtras?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { need, falInput, estimateExtras } = body;
  if (!need || !(need in REGISTRY)) {
    return NextResponse.json({ error: "unknown or missing need" }, { status: 400 });
  }
  if (!falInput || typeof falInput !== "object") {
    return NextResponse.json({ error: "falInput required" }, { status: 400 });
  }

  try {
    const result = await runJob({
      userId: user.id,
      userEmail: user.email ?? null,
      need,
      falInput,
      estimateExtras,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    console.error("submit failed", err);
    return NextResponse.json({ error: "submit_failed" }, { status: 500 });
  }
}
