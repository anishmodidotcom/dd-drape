// Drape multi-model router registry.
//
// Callers NEVER hardcode a fal model slug. They ask for a job NEED. This registry maps
// each need to the cheapest capable VERIFIED fal model and its per-unit provider cost.
//
// Pricing drifts. VERIFY live before first spend via:
//   GET https://fal.run/v1/models/pricing?endpoint_id=SLUG  (or the documented pricing endpoint)
// The unitCostCents values below are seeded from the mid-2026 verified stack and are the
// estimator's defaults; the estimator can be overridden with a live-fetched cost.

export type Need =
  | "image/standard"
  | "image/hero"
  | "tryon"
  | "image/edit"
  | "bg-remove"
  | "video/standard"
  | "video/hero"
  | "upscale/video";

// What the per-unit cost is measured in.
export type CostUnit = "image" | "second" | "megapixel" | "token";

export interface ModelEntry {
  /** Verified fal endpoint slug, used verbatim at the fal call site. */
  slug: string;
  /** Unit the provider bills in. */
  unit: CostUnit;
  /** Provider cost per unit, in US cents. 1 credit = 1 cent = $0.01. */
  unitCostCents: number;
  /** True for long-running jobs that must go through the worker + webhook, not subscribe(). */
  async: boolean;
  /** Human note on why this model is the default for the need. */
  note: string;
}

// Cheapest capable verified model per need. Swap a slug here, every call site follows.
export const REGISTRY: Record<Need, ModelEntry> = {
  // STANDARD photoreal batches + pipeline testing. Cheapest image model: test here first.
  "image/standard": {
    slug: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    unit: "image",
    unitCostCents: 4, // $0.04 / image
    async: false,
    note: "Seedream 4.5 - cheap photoreal, used for STANDARD + end-to-end pipeline testing.",
  },
  // HERO + multi-reference fidelity (up to 14 reference images, 4K, text-in-image).
  "image/hero": {
    slug: "fal-ai/nano-banana-pro",
    unit: "image",
    unitCostCents: 15, // $0.15 / image
    async: false,
    note: "Nano Banana Pro - hero fidelity, multi-subject consistency, reference-locked.",
  },
  // Virtual try-on: garment on model. Core capability.
  tryon: {
    slug: "fal-ai/fashn",
    unit: "image",
    unitCostCents: 8, // $0.075 / gen, rounded up to whole cents at estimate time
    async: false,
    note: "FASHN v1.5 - garment-on-model virtual try-on. Verify slug before first spend.",
  },
  // Instruction / reference edits (background swaps via reference, no masks).
  "image/edit": {
    slug: "fal-ai/nano-banana-pro",
    unit: "image",
    unitCostCents: 15, // $0.15 / edit
    async: false,
    note: "Nano Banana Pro edit - up to 14 refs, no masks, high fidelity edits.",
  },
  // Background removal.
  "bg-remove": {
    slug: "fal-ai/bria/rmbg/2.0",
    unit: "image",
    unitCostCents: 2, // $0.018 / gen, rounded up
    async: false,
    note: "Bria RMBG 2.0 - background removal / garment clean.",
  },
  // STANDARD video. Always i2v (anchored to a generated still as first frame).
  "video/standard": {
    slug: "fal-ai/bytedance/seedance-2.0/image-to-video",
    unit: "second",
    unitCostCents: 30.24, // $0.3024 / sec
    async: true,
    note: "Seedance 2.0 i2v - default video, native audio, start+end frame.",
  },
  // HERO video. Premium 4K with audio.
  "video/hero": {
    slug: "fal-ai/veo3.1",
    unit: "second",
    unitCostCents: 40, // $0.40 / sec w/ audio
    async: true,
    note: "Veo 3.1 - premium 4K hero shots with audio.",
  },
  // Video upscale.
  "upscale/video": {
    slug: "fal-ai/topaz/upscale/video",
    unit: "second",
    unitCostCents: 8, // $0.01-0.08 / sec by tier; default to top tier for safe estimate
    async: true,
    note: "Topaz video upscale - cost varies by tier, estimate at top tier.",
  },
};

export function lookup(need: Need): ModelEntry {
  const entry = REGISTRY[need];
  if (!entry) {
    throw new Error(`No model registered for need "${need}"`);
  }
  return entry;
}

export function isAsyncNeed(need: Need): boolean {
  return lookup(need).async;
}
