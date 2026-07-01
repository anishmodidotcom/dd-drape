import "server-only";
import { fal } from "@fal-ai/client";
import { signedUrl, storeFromUrlAt } from "./storage";

// Still upscale pass (audit fix 4, docs/ENGINE_QUALITY_AUDIT.md 3.3). A quality polish step for the
// Hero/Replace path, applied only AFTER the fidelity gate has already verified the result, so we
// never spend an upscale call on a shot that is about to be refunded.
//
// FEATURE-FLAGGED OFF BY DEFAULT. Verifying an exact fal upscaler slug and its input schema was out
// of the Step 0 live-test budget (that budget was reserved for the negative-prompt question, per the
// task). Rather than guess a slug name and ship an unverified integration, the slug is pluggable via
// env: set DRAPE_UPSCALE_SLUG once a real fal upscaler has been live-tested and confirmed (mirrors
// this codebase's own existing precedent for an unverified slug: "video/hero" -> veo3.1 in
// registry.ts, registered with a "verify before first spend" note, never wired into a reachable
// default path until confirmed). Bundled into the existing Hero/Replace price: no extra credit cost.
export async function maybeUpscaleImage(outputPath: string): Promise<void> {
  const slug = process.env.DRAPE_UPSCALE_SLUG;
  if (!slug) return; // disabled: no-op, the gate-verified original stands as delivered

  const key = process.env.FAL_KEY;
  if (!key) return;

  const sourceUrl = await signedUrl(outputPath, 600);
  const result = await fal.subscribe(slug, {
    input: { image_url: sourceUrl },
    logs: false,
  });
  const data = result.data as Record<string, unknown>;
  const upscaledUrl =
    (data.image as { url?: string } | undefined)?.url ??
    (Array.isArray(data.images) ? (data.images[0] as { url?: string } | undefined)?.url : undefined);
  if (!upscaledUrl) throw new Error("upscaler returned no image URL");

  // Overwrite the already-verified output at the same storage path; nothing else about the job
  // (credits, provenance, fidelity status) changes.
  await storeFromUrlAt(outputPath, upscaledUrl);
}
