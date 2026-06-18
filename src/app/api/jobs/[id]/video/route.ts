import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getJob } from "@/lib/engine/jobs";
import { runJob } from "@/lib/engine/run";
import { signedUrl } from "@/lib/engine/storage";
import { buildMotionPrompt } from "@/lib/shot/motion";
import { videoEnabled } from "@/lib/engine/features";
import { InsufficientCreditsError } from "@/lib/engine/ledger";
import type { ShotSpec } from "@/lib/shot/spec";

// POST /api/jobs/[id]/video  { motionPreset?, seconds? }
// Animate a finished still into a clip (i2v). The still is the first frame, so the product stays
// locked. Creates a queued video job; the Railway worker submits it to fal and the webhook settles.
//
// Audit item 2: video is gated behind DRAPE_VIDEO_ENABLED (default OFF) until the final-pass
// rebuild verifies the pipeline. When OFF we fail fast and clean BEFORE reserving or creating a
// job, so the user is never charged and never left with a stuck job. The falInput uses
// start_image_url (the field the registry's Kling slug expects); the worker submits the same slug.

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Fail fast + clean while video is in beta / unverified: no reserve, no job, no charge.
  if (!videoEnabled()) {
    return NextResponse.json(
      { error: "video_unavailable", message: "Video is in beta and temporarily unavailable. You were not charged." },
      { status: 503 }
    );
  }

  const { id } = await ctx.params;

  const still = await getJob(id);
  if (!still || still.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (still.status !== "done" || !still.result_ref) {
    return NextResponse.json({ error: "still is not ready" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const meta = (still.payload?.meta ?? {}) as Record<string, unknown>;
  const spec = (meta.spec as ShotSpec | undefined) ?? null;
  const seconds = Math.min(8, Math.max(5, Number(body.seconds) || spec?.video?.seconds || 5));
  const motionPreset: string | undefined = body.motionPreset ?? spec?.video?.motionPreset;

  // The motion prompt needs the spec for rigid-vs-fabric handling; fall back to a generic spec.
  const motionSpec: ShotSpec =
    spec ??
    ({
      category: (meta.category as ShotSpec["category"]) ?? "apparel",
      subType: (meta.subType as string) ?? "dress",
      shotType: "lifestyle",
      referenceImagePaths: [],
    } as ShotSpec);

  const stillUrl = await signedUrl(still.result_ref, 3600);
  const prompt = buildMotionPrompt(motionSpec, motionPreset);

  try {
    const result = await runJob({
      userId: user.id,
      userEmail: user.email ?? null,
      need: "video/standard",
      creditLabel: "Video",
      // Kling v3 pro i2v expects start_image_url (the approved still = first frame).
      falInput: { start_image_url: stillUrl, prompt, duration: seconds },
      estimateExtras: { seconds },
      tier: still.tier,
      parentJobId: still.id,
      meta: { spec: motionSpec, fromStill: still.id, motionPreset, seconds },
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    return NextResponse.json({ error: "video_failed" }, { status: 500 });
  }
}
