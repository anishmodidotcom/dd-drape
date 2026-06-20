import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { runShot, runShoot, runReplaceVideo } from "@/lib/engine/run-shot";
import { InsufficientCreditsError } from "@/lib/engine/ledger";
import { MAX_OUTPUTS, MAX_PRODUCTS, type ShotSpec } from "@/lib/shot/spec";

// POST /api/shots  { spec: ShotSpec }
// The core generation endpoint. Reserves credits, generates a reference-locked still, and applies
// tier behaviour. Returns the job id + status so the UI can open the result screen.

export const runtime = "nodejs";
export const maxDuration = 300;

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
  if (!spec || !spec.category || !spec.subType || !spec.shotType) {
    return NextResponse.json(
      { error: "spec requires category, subType and shotType" },
      { status: 400 }
    );
  }
  if (!Array.isArray(spec.referenceImagePaths) || spec.referenceImagePaths.length === 0) {
    return NextResponse.json(
      { error: "at least one product reference image is required" },
      { status: 400 }
    );
  }
  if (spec.referenceImagePaths.length > MAX_PRODUCTS) {
    return NextResponse.json({ error: `at most ${MAX_PRODUCTS} products per shot` }, { status: 400 });
  }
  if ((spec.outputCount ?? 1) > MAX_OUTPUTS) {
    return NextResponse.json({ error: `at most ${MAX_OUTPUTS} outputs per shoot` }, { status: 400 });
  }

  try {
    // Replace-into-video (item 6): two-stage swap-then-animate.
    if (spec.replace?.sourceVideoPath) {
      const result = await runReplaceVideo(user.id, user.email ?? null, spec);
      return NextResponse.json(result, { status: 202 });
    }
    // Directed multi-output shoot (item 5).
    if ((spec.outputCount ?? 1) > 1) {
      const result = await runShoot(user.id, user.email ?? null, spec);
      return NextResponse.json(result, { status: 202 });
    }
    // Single still (single or multi-product, identity, replace-image).
    const result = await runShot(user.id, user.email ?? null, spec);
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    console.error("shot failed", err);
    return NextResponse.json({ error: "shot_failed" }, { status: 500 });
  }
}
