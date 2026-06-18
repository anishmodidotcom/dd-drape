import "server-only";
import { classifyTier, type Tier } from "@/lib/engine/tier";
import { redPolicy } from "@/lib/shot/compose";
import type { ShotSpec } from "@/lib/shot/spec";
import { directorEnabled } from "./client";
import { analyzeProduct } from "./analyze";
import { composeShot } from "./compose";
import { route } from "./route";
import {
  fallbackAnalysis,
  fallbackCompose,
  specToIntentText,
} from "./fallback";
import type { Composition, ProductAnalysis, ReferenceImages, RoutedGeneration } from "./schema";

// The prompt-director orchestrator: Analyze -> Compose -> Route, with deterministic fallback.
// Returns everything the job runner needs to generate a reference-locked still.

export interface DirectInput {
  spec: ShotSpec;
  /** Signed, fetchable product image URLs (the exact item). At least one required. */
  productImageUrls: string[];
  /** Optional saved-model identity reference URL(s). */
  modelIdentityUrls?: string[];
  /** Optional scene/vibe reference URL. */
  sceneUrl?: string;
  /** Free-text brief from the user. */
  freeBrief?: string;
  /** Cached analysis from drape_products, to skip re-analysis. */
  cachedAnalysis?: ProductAnalysis | null;
}

export interface DirectResult {
  analysis: ProductAnalysis;
  composition: Composition;
  routed: RoutedGeneration;
  tier: Tier;
  /** Set when RED policy blocks generation (no fabricated facets). */
  blocked?: string;
  /** Whether Claude (vs the deterministic fallback) produced the composition. */
  usedClaude: boolean;
}

export async function directShot(input: DirectInput): Promise<DirectResult> {
  const { spec, productImageUrls } = input;
  if (!productImageUrls || productImageUrls.length === 0) {
    throw new Error("directShot: at least one product image is required");
  }
  const hasModelIdentity = !!(input.modelIdentityUrls && input.modelIdentityUrls.length > 0);
  let usedClaude = false;

  // Stage 1 - Analyze (cached if available).
  let analysis: ProductAnalysis;
  if (input.cachedAnalysis) {
    analysis = input.cachedAnalysis;
  } else if (directorEnabled()) {
    try {
      analysis = await analyzeProduct(productImageUrls[0]);
      usedClaude = true;
    } catch {
      analysis = fallbackAnalysis(spec);
    }
  } else {
    analysis = fallbackAnalysis(spec);
  }

  // Stage 2 - Compose.
  let composition: Composition;
  if (directorEnabled()) {
    try {
      composition = await composeShot(analysis, {
        intentText: specToIntentText(spec, input.freeBrief),
        hasModelIdentity,
        referenceCount: productImageUrls.length + (hasModelIdentity ? 1 : 0) + (input.sceneUrl ? 1 : 0),
      });
      usedClaude = true;
    } catch {
      composition = fallbackCompose(spec, analysis, hasModelIdentity);
    }
  } else {
    composition = fallbackCompose(spec, analysis, hasModelIdentity);
  }

  // Safety: tryon requires a model identity; downgrade to hero fidelity if missing.
  if (composition.model_route === "tryon" && !hasModelIdentity) {
    composition.model_route = "image/hero";
  }

  // Tier + RED policy (no fabricated facets).
  const tier = classifyTier({
    category: analysis.product_category ?? spec.category,
    subType: analysis.garment_subtype ?? spec.subType,
    shotType: spec.shotType,
  });
  const policy = redPolicy(spec, tier);

  // Stage 3 - Route (deterministic; attaches the product image, guards against text-to-image).
  const refs: ReferenceImages = {
    product: productImageUrls,
    modelIdentity: input.modelIdentityUrls,
    scene: input.sceneUrl,
  };
  const routed = route(composition, refs);

  return {
    analysis,
    composition,
    routed,
    tier,
    blocked: policy.blocked ? policy.message : undefined,
    usedClaude,
  };
}
