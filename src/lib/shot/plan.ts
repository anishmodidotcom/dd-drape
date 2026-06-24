// Single source of truth for routing + pricing decisions. BOTH /api/estimate and the real
// generation (directShot) call this, so the quoted credits always equal the charged credits.
//
// The deterministic NEED selection here is the cost-bearing decision. Claude's compose stage still
// writes the prompt/params, but it does NOT get to change the route (and therefore the price): the
// director overrides composition.model_route with planNeed() before routing. This removes the
// second routing brain the audit found (estimate quoting 15 while a saved-model shot charged 8).

import { classifyTier, type Tier } from "@/lib/engine/tier";
import type { Need } from "@/lib/engine/registry";
import { estimate } from "@/lib/engine/estimator";
import { redPolicy } from "./compose";
import { planShootFrames, clampOutputCount } from "./shoot";
import type { ShotSpec } from "./spec";

export function hasModelIdentity(spec: ShotSpec): boolean {
  return !!(spec.modelImagePaths && spec.modelImagePaths.length > 0);
}

export function productCount(spec: ShotSpec): number {
  return spec.referenceImagePaths?.length || 1;
}
export function isReplace(spec: ShotSpec): boolean {
  return !!(spec.replace?.sourceImagePath || spec.replace?.sourceVideoPath);
}

// Deterministic capability selection. Reference-capable only (never text-to-image). This is the
// single cost-bearing decision shared by /api/estimate and the director, so quoted == charged.
export function planNeed(spec: ShotSpec): Need {
  // Replace (item 6) takes priority: swap product(s) into a source still or clip.
  if (spec.replace?.sourceVideoPath) return "video/replace";
  if (spec.replace?.sourceImagePath) return "image/replace";

  const multiProduct = productCount(spec) > 1;
  const isEdit =
    spec.shotType === "background-swap" ||
    spec.shotType === "colour-variant" ||
    spec.shotType === "flat-lay";
  const isOnModel =
    spec.shotType === "on-model-full" ||
    spec.shotType === "lifestyle" ||
    spec.framing === "full-length" ||
    spec.framing === "three-quarter";

  // Try-on (FASHN) is single-garment only: never route multi-product through it.
  if (hasModelIdentity(spec) && spec.category === "apparel" && isOnModel && !multiProduct) return "tryon";
  // Multi-product needs the multi-reference edit model (up to 14 refs), so it always uses hero.
  if (multiProduct) return "image/hero";
  if (spec.quality === "standard") return "image/standard";
  if (isEdit) return "image/edit";
  return "image/hero";
}

export interface RoutePlan {
  need: Need;
  tier: Tier;
  /** RED-tier block message, if generation should be refused (and refunded). */
  blocked?: string;
}

export function planRoute(spec: ShotSpec): RoutePlan {
  const need = planNeed(spec);
  const tier = classifyTier({ category: spec.category, subType: spec.subType, shotType: spec.shotType });
  const policy = redPolicy(spec, tier);
  return { need, tier, blocked: policy.blocked ? policy.message : undefined };
}

// Total credits for a request, the SINGLE source of truth used by /api/estimate and the runners so
// quoted == charged. Covers a directed shoot (item 5: sum of per-frame routes) and video (seconds).
export function planCredits(spec: ShotSpec): { need: Need; count: number; credits: number } {
  const count = clampOutputCount(spec.outputCount);
  if (count > 1) {
    const frames = planShootFrames(spec, count);
    const credits = frames.reduce((s, f) => s + estimate({ need: planNeed(f.spec), count: 1 }).credits, 0);
    return { need: planNeed(spec), count, credits };
  }
  const need = planNeed(spec);
  const isVideo = need.startsWith("video/");
  const credits = estimate({ need, count: 1, ...(isVideo ? { seconds: spec.video?.seconds ?? 5 } : {}) }).credits;
  return { need, count: 1, credits };
}
