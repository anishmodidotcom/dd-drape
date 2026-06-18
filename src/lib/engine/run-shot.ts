import "server-only";
import type { ShotSpec } from "@/lib/shot/spec";
import { signedUrl, pathBelongsToUser } from "./storage";
import { runJob, type RunResult } from "./run";
import type { QcStatus } from "./jobs";
import { directShot } from "@/lib/director";
import { getOrAnalyzeProduct } from "@/lib/director/products";

// Runs a product shot through the v2 prompt-director: resolve references, analyze the product
// (cached), compose a reference-locked plan, route it to a reference-capable slug with the product
// image attached, then hand off to the credit-safe job runner with the fidelity gate enabled.

async function resolveOwned(userId: string, paths: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const path of paths) {
    if (!pathBelongsToUser(path, userId)) {
      throw new Error("reference image does not belong to the caller");
    }
    urls.push(await signedUrl(path, 3600));
  }
  return urls;
}

export async function runShot(
  userId: string,
  userEmail: string | null,
  spec: ShotSpec
): Promise<RunResult> {
  const productPaths = spec.referenceImagePaths ?? [];
  if (productPaths.length === 0) throw new Error("at least one product image is required");

  const productUrls = await resolveOwned(userId, productPaths);
  const modelIdentityUrls = spec.modelImagePaths?.length
    ? await resolveOwned(userId, spec.modelImagePaths)
    : undefined;
  const sceneUrl = spec.vibeReferencePath
    ? (await resolveOwned(userId, [spec.vibeReferencePath]))[0]
    : undefined;

  // Stage 1 cache: analyze the primary product image once (no-op without ANTHROPIC_API_KEY).
  const cachedAnalysis = await getOrAnalyzeProduct(userId, productPaths[0], productUrls[0]);

  // Analyze -> Compose -> Route (guarded; product image always attached to a reference slug).
  const directed = await directShot({
    spec,
    productImageUrls: productUrls,
    modelIdentityUrls,
    sceneUrl,
    freeBrief: spec.freeBrief,
    cachedAnalysis,
  });

  const qcStatus: QcStatus = directed.tier === "amber" ? "pending" : "none";

  return runJob({
    userId,
    userEmail,
    need: directed.routed.need,
    falInput: directed.routed.falInput,
    estimateExtras: { count: 1 },
    tier: directed.tier,
    qcStatus,
    blocked: directed.blocked,
    fidelityGate: { sourceUrl: productUrls[0] },
    meta: {
      spec,
      analysis: directed.analysis,
      fidelityLocks: directed.routed.fidelityLocks,
      usedClaude: directed.usedClaude,
      referenceImagePaths: productPaths,
      category: directed.analysis.product_category ?? spec.category,
      subType: directed.analysis.garment_subtype ?? spec.subType,
      shotType: spec.shotType,
      format: spec.format ?? null,
      aiLabel: spec.aiLabel ?? true,
      video: spec.video ?? null,
    },
  });
}
