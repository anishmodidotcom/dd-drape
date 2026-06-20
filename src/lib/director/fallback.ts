// Deterministic fallback for the director, used when ANTHROPIC_API_KEY is absent or a Claude call
// fails. It still guarantees the v2 fidelity fix: a reference-capable route + the product image
// attached + explicit fidelity locks. Claude enriches this when available; it is never required
// for the product image to reach a reference-capable endpoint.

import type { Need } from "@/lib/engine/registry";
import { buildPrompt, referenceRolesClause } from "@/lib/shot/compose";
import { planNeed } from "@/lib/shot/plan";
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

// Serialize the wizard selections into a plain-language intent brief for Claude compose. Free text
// (global and per-control) is surfaced prominently and marked authoritative (item 4).
export function specToIntentText(spec: ShotSpec, freeBrief?: string): string {
  const lines: string[] = [];
  const products = spec.referenceImagePaths?.length || 1;
  lines.push(`Category: ${spec.category}, sub-type: ${spec.subType}, shot type: ${spec.shotType}.`);
  if (products > 1) lines.push(`MULTIPLE PRODUCTS: ${products} distinct articles to compose on one model together, each preserved.`);
  if (spec.replace?.sourceImagePath) lines.push("REPLACE: swap the product(s) into the provided source still; keep its pose, scene and lighting.");
  if (spec.replace?.sourceVideoPath) lines.push("REPLACE INTO VIDEO: the product is swapped into the source's frame, then animated; preserve the product across frames.");
  if (spec.model) lines.push(`Model: ${JSON.stringify(spec.model)}.`);
  if (spec.modelImagePaths?.length) lines.push("A saved/uploaded model identity is attached; the output person must match it exactly (not a collage of the reference).");
  for (const k of ["makeup", "hair", "pose", "background", "lighting", "framing", "vibe", "region"] as const) {
    if (spec[k]) lines.push(`${k}: ${String(spec[k])}.`);
  }
  if (spec.colourVariant) lines.push(`Colour variant requested: ${spec.colourVariant}.`);
  if (spec.format) lines.push(`Output format: ${spec.format}.`);
  lines.push(`Quality: ${spec.quality ?? "hero"}.`);
  if ((spec.outputCount ?? 1) > 1) {
    lines.push(`DIRECTED SHOOT: ${spec.outputCount} frames as one coherent editorial set, ${spec.variateModel ? "varying the model across frames" : "the same model in every frame"}; vary pose, angle, framing and crop between frames like a real photographer working a look.`);
  }
  // Per-control free text is authoritative and may override the matching structured selection.
  if (spec.freeText) {
    for (const [control, text] of Object.entries(spec.freeText)) {
      if (text?.trim()) lines.push(`AUTHORITATIVE free text for "${control}": ${text.trim()}`);
    }
  }
  if (freeBrief) lines.push(`AUTHORITATIVE free brief (may override any selection above): ${freeBrief}`);
  return lines.join("\n");
}

function fabricPhysicsFor(analysis: ProductAnalysis): string {
  const fabric = (analysis.fabric ?? "").toLowerCase();
  for (const key of Object.keys(FABRIC_PHYSICS)) {
    if (fabric.includes(key)) return ` Render the fabric as ${FABRIC_PHYSICS[key]}.`;
  }
  return "";
}

// Choose a reference-capable route deterministically. Delegates to the single routing brain so the
// fallback and the live director never diverge on cost.
export function fallbackRoute(spec: ShotSpec, hasModelIdentity: boolean): Need {
  const s = hasModelIdentity && !spec.modelImagePaths?.length
    ? { ...spec, modelImagePaths: ["identity"] }
    : spec;
  return planNeed(s);
}

export function fallbackCompose(
  spec: ShotSpec,
  analysis: ProductAnalysis,
  hasModelIdentity: boolean
): Composition {
  const fmt = getFormat(spec.format);
  // buildPrompt already emits the reference-roles + single-subject lock from the spec. When identity
  // arrived out-of-band (resolved url without a spec path), append the roles clause explicitly.
  const productCount = spec.referenceImagePaths?.length || 1;
  const rolesAlreadyIn = productCount > 1 || !!spec.modelImagePaths?.length || !!spec.replace?.sourceImagePath;
  const positive =
    buildPrompt(spec) +
    fabricPhysicsFor(analysis) +
    (rolesAlreadyIn ? "" : hasModelIdentity ? " " + referenceRolesClause({ productCount, hasIdentity: true }) : "");

  const locks: string[] = [`exact ${spec.subType}`, `${spec.category} construction and detailing`];
  if (analysis.primary_color_name) locks.push(`colour ${analysis.primary_color_name}`);
  if (analysis.print_or_pattern) locks.push(`pattern ${analysis.print_or_pattern}`);

  const need = fallbackRoute(spec, hasModelIdentity);
  const params: Composition["params"] =
    need === "image/hero" || need === "image/replace"
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
