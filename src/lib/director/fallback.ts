// Deterministic fallback for the director, used when ANTHROPIC_API_KEY is absent or a Claude call
// fails. It still guarantees the v2 fidelity fix: a reference-capable route + the product image
// attached + explicit fidelity locks. Claude enriches this when available; it is never required
// for the product image to reach a reference-capable endpoint.

import type { Need } from "@/lib/engine/registry";
import { buildPrompt } from "@/lib/shot/compose";
import { getFormat } from "@/lib/shot/formats";
import type { ShotSpec } from "@/lib/shot/spec";
import { ANTI_SLOP_NEGATIVE, FABRIC_PHYSICS } from "./prompts";
import { emptyAnalysis, type Composition, type ProductAnalysis } from "./schema";

export function fallbackAnalysis(spec: ShotSpec): ProductAnalysis {
  const a = emptyAnalysis();
  a.product_category = spec.category;
  a.garment_subtype = spec.subType;
  a.confidence = { product_category: 0.5, garment_subtype: 0.5 };
  return a;
}

// Serialize the wizard selections into a plain-language intent brief for Claude compose.
export function specToIntentText(spec: ShotSpec, freeBrief?: string): string {
  const lines: string[] = [];
  lines.push(`Category: ${spec.category}, sub-type: ${spec.subType}, shot type: ${spec.shotType}.`);
  if (spec.model) lines.push(`Model: ${JSON.stringify(spec.model)}.`);
  for (const k of ["makeup", "hair", "pose", "background", "lighting", "framing", "vibe", "region"] as const) {
    if (spec[k]) lines.push(`${k}: ${String(spec[k])}.`);
  }
  if (spec.colourVariant) lines.push(`Colour variant requested: ${spec.colourVariant}.`);
  if (spec.format) lines.push(`Output format: ${spec.format}.`);
  lines.push(`Quality: ${spec.quality ?? "hero"}.`);
  if (freeBrief) lines.push(`Free brief: ${freeBrief}`);
  return lines.join("\n");
}

function fabricPhysicsFor(analysis: ProductAnalysis): string {
  const fabric = (analysis.fabric ?? "").toLowerCase();
  for (const key of Object.keys(FABRIC_PHYSICS)) {
    if (fabric.includes(key)) return ` Render the fabric as ${FABRIC_PHYSICS[key]}.`;
  }
  return "";
}

// Choose a reference-capable route deterministically.
export function fallbackRoute(spec: ShotSpec, hasModelIdentity: boolean): Need {
  const isEdit =
    spec.shotType === "background-swap" ||
    spec.shotType === "colour-variant" ||
    spec.shotType === "flat-lay";
  const isOnModel =
    spec.shotType === "on-model-full" ||
    spec.shotType === "lifestyle" ||
    spec.framing === "full-length" ||
    spec.framing === "three-quarter";

  if (hasModelIdentity && spec.category === "apparel" && isOnModel) return "tryon";
  if (spec.quality === "standard") return "image/standard";
  if (isEdit) return "image/edit";
  return "image/hero";
}

export function fallbackCompose(
  spec: ShotSpec,
  analysis: ProductAnalysis,
  hasModelIdentity: boolean
): Composition {
  const fmt = getFormat(spec.format);
  const positive = buildPrompt(spec) + fabricPhysicsFor(analysis) + " " +
    "Image 1 is the exact product, preserve it." +
    (hasModelIdentity ? " Image 2 is the model identity to wear it." : "");

  const locks: string[] = [`exact ${spec.subType}`, `${spec.category} construction and detailing`];
  if (analysis.primary_color_name) locks.push(`colour ${analysis.primary_color_name}`);
  if (analysis.print_or_pattern) locks.push(`pattern ${analysis.print_or_pattern}`);

  const need = fallbackRoute(spec, hasModelIdentity);
  const params: Composition["params"] =
    need === "image/hero"
      ? { resolution: "2K", num_images: 1, aspect_ratio: fmt.ratio === "free" ? undefined : fmt.ratio }
      : { num_images: 1, image_size: { width: fmt.width, height: fmt.height } };

  return {
    positive_prompt: positive,
    negative_prompt: ANTI_SLOP_NEGATIVE,
    model_route: need,
    params,
    fidelity_locks: locks,
  };
}
