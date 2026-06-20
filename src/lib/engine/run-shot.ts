import "server-only";
import type { ShotSpec } from "@/lib/shot/spec";
import { signedUrl, pathBelongsToUser } from "./storage";
import { runJob, type RunResult } from "./run";
import type { QcStatus } from "./jobs";
import { creditBalance } from "./credits";
import { InsufficientCreditsError } from "./ledger";
import { videoEnabled } from "./features";
import { planCredits } from "@/lib/shot/plan";
import { planShootFrames, clampOutputCount } from "@/lib/shot/shoot";
import { directShot } from "@/lib/director";
import { getOrAnalyzeProduct, saveProductToCollection } from "@/lib/director/products";

// Runs product generations through the prompt-director: resolve references, analyze EACH product
// (cached), compose a reference-locked plan, route to a reference-capable slug with the product
// image(s) attached, then hand off to the credit-safe job runner with the multi-product fidelity
// gate enabled. Handles single + multi-product, saved/uploaded identity, replace (image + video),
// and multi-output directed shoots.

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

interface RunShotOpts {
  parentJobId?: string | null;
}

export async function runShot(
  userId: string,
  userEmail: string | null,
  spec: ShotSpec,
  opts: RunShotOpts = {}
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
  const replaceSourceUrl = spec.replace?.sourceImagePath
    ? (await resolveOwned(userId, [spec.replace.sourceImagePath]))[0]
    : undefined;

  // Item 8: persist the product(s) to the collection on request (best-effort, never blocks a shot).
  if (spec.saveProduct) {
    await Promise.all(productPaths.map((p) => saveProductToCollection(userId, p).catch(() => {})));
  }

  // Stage 1 cache: analyze EACH product once (no-op without ANTHROPIC_API_KEY). Item 2.
  const cachedAnalyses = await Promise.all(
    productPaths.map((p, i) => getOrAnalyzeProduct(userId, p, productUrls[i]))
  );

  // Analyze -> Compose -> Route (guarded; product image(s) always attached to a reference slug).
  const directed = await directShot({
    spec,
    productImageUrls: productUrls,
    modelIdentityUrls,
    sceneUrl,
    replaceSourceUrl,
    freeBrief: spec.freeBrief,
    cachedAnalyses,
  });

  const qcStatus: QcStatus = directed.tier === "amber" ? "pending" : "none";
  const subLabel = (directed.analysis.garment_subtype ?? spec.subType)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const isReplace = !!replaceSourceUrl;

  return runJob({
    userId,
    userEmail,
    need: directed.routed.need,
    falInput: directed.routed.falInput,
    estimateExtras: { count: 1 },
    tier: directed.tier,
    qcStatus,
    blocked: directed.blocked,
    parentJobId: opts.parentJobId ?? null,
    creditLabel: isReplace ? "Replace" : `${subLabel} shot`,
    // Gate every product against the output (item 2/12). Replace included.
    fidelityGate: { sourceUrls: productUrls },
    meta: {
      spec,
      analysis: directed.analysis,
      analyses: directed.analyses,
      fidelityLocks: directed.routed.fidelityLocks,
      usedClaude: directed.usedClaude,
      referenceImagePaths: productPaths,
      productCount: productPaths.length,
      replace: isReplace,
      category: directed.analysis.product_category ?? spec.category,
      subType: directed.analysis.garment_subtype ?? spec.subType,
      shotType: spec.shotType,
      format: spec.format ?? null,
      aiLabel: spec.aiLabel ?? true,
      video: spec.video ?? null,
    },
  });
}

export interface ShootResult {
  jobId: string; // the group anchor (first frame)
  count: number;
  frames: RunResult[];
}

// Item 5: a directed shoot of N art-directed frames. Reserve-for-N (affordability checked upfront),
// then each frame settles on delivery and refunds on failure (per-frame, idempotent). The frames
// are grouped under the first frame via parent_job_id.
export async function runShoot(
  userId: string,
  userEmail: string | null,
  spec: ShotSpec
): Promise<ShootResult> {
  const count = clampOutputCount(spec.outputCount);
  if (count <= 1) {
    const r = await runShot(userId, userEmail, spec);
    return { jobId: r.jobId, count: 1, frames: [r] };
  }
  const frames = planShootFrames(spec, count);

  // Quote = sum of each frame's deterministic route cost (quoted == charged on success), from the
  // single source of truth shared with /api/estimate.
  const total = planCredits(spec).credits;
  const balance = await creditBalance(userId);
  if (balance < total) throw new InsufficientCreditsError(balance, total);

  const results: RunResult[] = [];
  let groupId: string | undefined;
  for (let i = 0; i < frames.length; i++) {
    const r = await runShot(userId, userEmail, frames[i].spec, { parentJobId: groupId ?? null });
    if (i === 0) groupId = r.jobId;
    results.push(r);
  }
  return { jobId: groupId!, count: frames.length, frames: results };
}

export interface ReplaceVideoResult {
  jobId: string; // the queued video job (async)
  stillJobId: string; // the product-swapped still
  status: RunResult["status"];
  message?: string;
}

// Item 6 (replace into video): swap the product(s) into the source's frame (sync image/replace),
// then enqueue an i2v anchored to that swapped still so the product stays locked across frames.
// Capability note: the source's exact motion is re-synthesized by i2v, not lifted frame-by-frame
// (no production video-to-video product-swap slug); documented as a gap. Runtime dependency: the
// async video job is claimed by the Railway worker (npm run worker); when video is disabled it
// fails cleanly with an auto-refund and never charges.
export async function runReplaceVideo(
  userId: string,
  userEmail: string | null,
  spec: ShotSpec
): Promise<ReplaceVideoResult> {
  if (!spec.replace?.sourceVideoPath) throw new Error("replace video requires a source video path");

  // Stage 1: produce the product-swapped first frame from the source video's representative still.
  // The client provides a still extracted from (or representing) the clip as replace.sourceImagePath.
  const stillSpec: ShotSpec = {
    ...spec,
    replace: { sourceImagePath: spec.replace.sourceImagePath },
    video: undefined,
  };
  const still = await runShot(userId, userEmail, stillSpec);
  if (still.status !== "done" || !still.resultPath) {
    return { jobId: still.jobId, stillJobId: still.jobId, status: still.status, message: still.message };
  }

  // Stage 2: enqueue the i2v anchored to the swapped still. Honest gating: if video is off, fail
  // cleanly (no charge) rather than queue a job the worker will not deliver.
  const seconds = spec.video?.seconds ?? 5;
  if (!videoEnabled()) {
    return {
      jobId: still.jobId,
      stillJobId: still.jobId,
      status: "failed",
      message: "Video is in beta and currently switched off. The product was swapped into the still.",
    };
  }
  const startUrl = await signedUrl(still.resultPath, 3600);
  const video = await runJob({
    userId,
    userEmail,
    need: "video/replace",
    falInput: {
      prompt: "Animate naturally while preserving the swapped product exactly across every frame.",
      start_image_url: startUrl,
      duration: seconds,
    },
    estimateExtras: { count: 1, seconds },
    parentJobId: still.jobId,
    creditLabel: "Replace video",
    meta: { spec, replace: true, sourceStillJobId: still.jobId },
  });
  return { jobId: video.jobId, stillJobId: still.jobId, status: video.status, message: video.message };
}
