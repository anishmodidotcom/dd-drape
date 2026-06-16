import "server-only";
import { buildGeneration } from "@/lib/shot/compose";
import type { ShotSpec } from "@/lib/shot/spec";
import { signedUrl, pathBelongsToUser } from "./storage";
import { runJob, type RunResult } from "./run";
import type { QcStatus } from "./jobs";

// Runs a product shot from a ShotSpec: resolves reference images, composes the reference-locked
// generation, applies tier behaviour (AMBER -> QC pending, RED -> enhancement or block), and
// hands off to the credit-safe job runner.

export async function runShot(
  userId: string,
  userEmail: string | null,
  spec: ShotSpec
): Promise<RunResult> {
  // Resolve uploaded product images to signed URLs fal can fetch. Enforce ownership.
  const refUrls: string[] = [];
  for (const path of spec.referenceImagePaths ?? []) {
    if (!pathBelongsToUser(path, userId)) {
      throw new Error("reference image does not belong to the caller");
    }
    refUrls.push(await signedUrl(path, 3600));
  }

  const gen = buildGeneration(spec, refUrls);

  // AMBER tier lands in QC review; GREEN/RED do not use the checklist gate.
  const qcStatus: QcStatus = gen.tier === "amber" ? "pending" : "none";

  return runJob({
    userId,
    userEmail,
    need: gen.need,
    falInput: gen.falInput,
    estimateExtras: gen.estimateExtras,
    tier: gen.tier,
    qcStatus,
    blocked: gen.blocked,
    meta: {
      spec, // full spec, so the result screen can regenerate or animate identically
      referenceImagePaths: spec.referenceImagePaths,
      category: spec.category,
      subType: spec.subType,
      shotType: spec.shotType,
      format: spec.format ?? null,
      aiLabel: spec.aiLabel ?? true,
      video: spec.video ?? null,
    },
  });
}
