import "server-only";
import { classifyTier, type Tier } from "@/lib/engine/tier";
import { redPolicy } from "@/lib/shot/compose";
import { planNeed } from "@/lib/shot/plan";
import { strengthFromLatitude } from "@/lib/shot/quality";
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
// Returns everything the job runner needs to generate a reference-locked still. Handles a single
// product, MULTIPLE distinct products (item 2), a saved/uploaded model identity (item 1/7), free
// text (item 4), and the Replace source (item 6).

export interface DirectInput {
  spec: ShotSpec;
  /** Signed, fetchable product image URLs, one per distinct article. At least one required. */
  productImageUrls: string[];
  /** Optional saved/uploaded model identity reference URL(s). */
  modelIdentityUrls?: string[];
  /** Optional scene/vibe reference URL. */
  sceneUrl?: string;
  /** Replace (item 6): the source still URL the product(s) are swapped into. */
  replaceSourceUrl?: string;
  /** Free-text brief from the user. */
  freeBrief?: string;
  /** Cached analysis per product (index-aligned with productImageUrls). Skips re-analysis. */
  cachedAnalyses?: (ProductAnalysis | null)[];
}

export interface DirectResult {
  /** Per-product analyses, index-aligned with productImageUrls. */
  analyses: ProductAnalysis[];
  /** Primary product analysis (analyses[0]); kept for back-compat. */
  analysis: ProductAnalysis;
  composition: Composition;
  routed: RoutedGeneration;
  tier: Tier;
  blocked?: string;
  usedClaude: boolean;
}

export async function directShot(input: DirectInput): Promise<DirectResult> {
  const { spec, productImageUrls } = input;
  if (!productImageUrls || productImageUrls.length === 0) {
    throw new Error("directShot: at least one product image is required");
  }
  const hasModelIdentity = !!(input.modelIdentityUrls && input.modelIdentityUrls.length > 0);
  let usedClaude = false;

  // Stage 1 - Analyze EACH product (cached per product where available). Item 2.
  const analyses: ProductAnalysis[] = [];
  for (let i = 0; i < productImageUrls.length; i++) {
    const cached = input.cachedAnalyses?.[i];
    if (cached) {
      analyses.push(cached);
    } else if (directorEnabled()) {
      try {
        analyses.push(await analyzeProduct(productImageUrls[i]));
        usedClaude = true;
      } catch {
        analyses.push(fallbackAnalysis(spec));
      }
    } else {
      analyses.push(fallbackAnalysis(spec));
    }
  }
  const analysis = analyses[0];

  // Build the intent. For multiple products, surface every product's analysis so the director
  // reasons about each distinct article it must preserve simultaneously.
  let intentText = specToIntentText(spec, input.freeBrief);
  if (analyses.length > 1) {
    intentText =
      `PRODUCT ANALYSES (${analyses.length} distinct articles, preserve each):\n` +
      analyses.map((a, i) => `Product ${i + 1}: ${JSON.stringify(a)}`).join("\n") +
      "\n\n" +
      intentText;
  }

  // Stage 2 - Compose.
  let composition: Composition;
  if (directorEnabled()) {
    try {
      composition = await composeShot(analysis, {
        intentText,
        hasModelIdentity,
        referenceCount:
          (input.replaceSourceUrl ? 1 : 0) +
          productImageUrls.length +
          (hasModelIdentity ? input.modelIdentityUrls!.length : 0) +
          (input.sceneUrl ? 1 : 0),
      });
      usedClaude = true;
    } catch {
      composition = fallbackCompose(spec, analysis, hasModelIdentity);
    }
  } else {
    composition = fallbackCompose(spec, analysis, hasModelIdentity);
  }

  // ONE routing brain: the cost-bearing route is decided deterministically by planNeed, identical to
  // what /api/estimate quoted. planNeed reads model identity + product count + replace from the
  // spec; reflect identity passed via modelIdentityUrls so the route matches.
  const routeSpec: ShotSpec = hasModelIdentity
    ? { ...spec, modelImagePaths: spec.modelImagePaths?.length ? spec.modelImagePaths : input.modelIdentityUrls }
    : spec;
  composition.model_route = planNeed(routeSpec);

  // Fidelity-latitude binding (audit fix 6): the user's explicit slider is deterministic and always
  // wins over whatever strength Claude may have guessed, same "one source of truth" pattern as the
  // route override above. Only overrides when the user actually set a latitude.
  const boundStrength = strengthFromLatitude(spec.latitude);
  if (boundStrength !== undefined) {
    composition.params = { ...composition.params, strength: boundStrength };
  }

  // Tier + RED policy (no fabricated facets).
  const tier = classifyTier({
    category: analysis.product_category ?? spec.category,
    subType: analysis.garment_subtype ?? spec.subType,
    shotType: spec.shotType,
  });
  const policy = redPolicy(spec, tier);

  // Stage 3 - Route (deterministic; attaches the references, guards against text-to-image).
  const refs: ReferenceImages = {
    product: productImageUrls,
    modelIdentity: input.modelIdentityUrls,
    scene: input.sceneUrl,
    replaceSource: input.replaceSourceUrl,
  };
  const routed = route(composition, refs);

  return {
    analyses,
    analysis,
    composition,
    routed,
    tier,
    blocked: policy.blocked ? policy.message : undefined,
    usedClaude,
  };
}
