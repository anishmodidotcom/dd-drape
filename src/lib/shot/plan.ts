// Single source of truth for routing + pricing decisions. BOTH /api/estimate and the real
// generation (directShot) call this, so the quoted credits always equal the charged credits.
//
// The deterministic NEED selection here is the cost-bearing decision. Claude's compose stage still
// writes the prompt/params, but it does NOT get to change the route (and therefore the price): the
// director overrides composition.model_route with planNeed() before routing. This removes the
// second routing brain the audit found (estimate quoting 15 while a saved-model shot charged 8).

import { classifyTier, type Tier } from "@/lib/engine/tier";
import type { Need } from "@/lib/engine/registry";
import { redPolicy } from "./compose";
import type { ShotSpec } from "./spec";

export function hasModelIdentity(spec: ShotSpec): boolean {
  return !!(spec.modelImagePaths && spec.modelImagePaths.length > 0);
}

// Deterministic capability selection. Reference-capable only (never text-to-image).
export function planNeed(spec: ShotSpec): Need {
  const isEdit =
    spec.shotType === "background-swap" ||
    spec.shotType === "colour-variant" ||
    spec.shotType === "flat-lay";
  const isOnModel =
    spec.shotType === "on-model-full" ||
    spec.shotType === "lifestyle" ||
    spec.framing === "full-length" ||
    spec.framing === "three-quarter";

  if (hasModelIdentity(spec) && spec.category === "apparel" && isOnModel) return "tryon";
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
