import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { buildGeneration } from "@/lib/shot/compose";
import { estimate } from "@/lib/engine/estimator";
import type { ShotSpec } from "@/lib/shot/spec";

// POST /api/estimate { spec }
// Dry-run: returns the chosen need, tier, credit cost, and any RED block, so the review step can
// show the price and tier badge before the user commits. No spend, no job created.

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { spec?: ShotSpec };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const spec = body.spec;
  if (!spec?.category || !spec.subType || !spec.shotType) {
    return NextResponse.json({ error: "incomplete spec" }, { status: 400 });
  }

  try {
    const gen = buildGeneration(spec, []);
    const est = estimate({ need: gen.need, ...gen.estimateExtras });
    return NextResponse.json({
      need: gen.need,
      tier: gen.tier,
      credits: est.credits,
      blocked: gen.blocked ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
