import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { signedUrl, pathBelongsToUser } from "@/lib/engine/storage";
import { getJob } from "@/lib/engine/jobs";
import { runJob } from "@/lib/engine/run";
import { videoEnabled } from "@/lib/engine/features";
import { InsufficientCreditsError } from "@/lib/engine/ledger";

// POST /api/video  { sourceShotId? | sourcePath?, seconds?, motionPreset?, motionIntensity?, brief? }
// The dedicated Video mode (3D). Animates an approved still (an existing shot) OR a freshly uploaded
// image, anchoring it as the first frame so the product stays locked across frames. Async: the
// Railway worker claims and delivers it. Beta + honest: when video is off it fails cleanly with no
// charge.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { sourceShotId?: string; sourcePath?: string; seconds?: number; motionPreset?: string; motionIntensity?: string; brief?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!videoEnabled()) {
    return NextResponse.json(
      { error: "Video is in beta and currently switched off. No credits were charged." },
      { status: 503 }
    );
  }

  // Resolve the start frame: a prior shot's result, or a freshly uploaded image.
  let startPath: string | null = null;
  if (body.sourceShotId) {
    const job = await getJob(body.sourceShotId);
    if (!job || job.user_id !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
    startPath = job.result_ref;
  } else if (body.sourcePath) {
    if (!pathBelongsToUser(body.sourcePath, user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    startPath = body.sourcePath;
  }
  if (!startPath) return NextResponse.json({ error: "a source shot or image is required" }, { status: 400 });

  const seconds = Math.min(8, Math.max(5, Math.floor(body.seconds ?? 5)));
  const motion = [body.motionPreset?.replace(/-/g, " "), body.motionIntensity, body.brief].filter(Boolean).join(", ");
  const prompt =
    `Animate naturally with ${motion || "subtle, elegant editorial motion"}. ` +
    "Preserve the product exactly across every frame: do not change its colour, print or shape. Keep it the locked anchor.";

  try {
    const startUrl = await signedUrl(startPath, 3600);
    const result = await runJob({
      userId: user.id,
      userEmail: user.email ?? null,
      need: "video/standard",
      falInput: { start_image_url: startUrl, prompt, duration: seconds },
      estimateExtras: { count: 1, seconds },
      creditLabel: "Video",
      meta: { video: { seconds, motionPreset: body.motionPreset ?? null }, sourceShotId: body.sourceShotId ?? null },
    });
    return NextResponse.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
    }
    console.error("video failed", err);
    return NextResponse.json({ error: "video_failed" }, { status: 500 });
  }
}
