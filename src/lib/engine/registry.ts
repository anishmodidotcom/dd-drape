// Drape multi-model router registry (v2).
//
// v2 FIDELITY FIX: every capability that conditions on the user's product routes to a
// reference-capable (edit / try-on) slug, NEVER a text-to-image slug. Each entry declares which
// fal input field(s) carry the reference image, so the router attaches it to the correct field.
// A guard (assertReferenceCapable) throws if a product job ever resolves to a text-to-image slug.
//
// Slugs + field names below are VERIFIED against the live fal input schemas:
//   fal-ai/bytedance/seedream/v4.5/edit   required [prompt, image_urls]
//   fal-ai/nano-banana-pro/edit           required [prompt, image_urls] (up to 14 refs, 1K/2K/4K)
//   openai/gpt-image-2/edit               required [prompt, image_urls]; optional mask_url
//   fal-ai/fashn/tryon/v1.6               required [model_image, garment_image]
//   fal-ai/bria/background/remove         required [image_url]
//   fal-ai/kling-video/v3/pro/image-to-video  required [start_image_url]
//
// Phase 5 (docs/ENGINE_QUALITY_AUDIT.md Step 0) LIVE-CONFIRMED on fal-ai/nano-banana-pro/edit:
// negative_prompt IS respected (an A/B with the same source, prompt and resolution:"2K" showed a
// visible reduction in golden-hour glow/haze and shallow-DoF background blur with a blur/glow
// negative present). resolution:"2K" also confirmed to actually change the render (1792x2400 output).
// Guardrails are built as belt-and-suspenders: strong negatives (this file's callers) PLUS an
// enforced positive quality block (src/lib/shot/quality.ts), never negative-only.

export type Need =
  | "image/standard"
  | "image/hero"
  | "tryon"
  | "image/edit"
  | "image/replace"
  | "bg-remove"
  | "video/standard"
  | "video/hero"
  | "video/replace"
  | "upscale/video";

export type CostUnit = "image" | "second" | "megapixel" | "token";

// How a model takes the product reference image.
//   image_urls   -> edit models (array of reference URLs)
//   image_url    -> single-image models (bg remove)
//   start_image  -> i2v video (start_image_url)
//   tryon        -> FASHN: garment_image + model_image
//   none         -> no image input (only valid for text-to-image, which products must never use)
export type RefShape = "image_urls" | "image_url" | "start_image" | "tryon" | "none";

export interface ModelEntry {
  slug: string;
  unit: CostUnit;
  unitCostCents: number;
  async: boolean;
  /** How the product reference attaches to this model's input. */
  refShape: RefShape;
  /** True only for text-to-image slugs. A product job must never resolve to one. */
  textToImage: boolean;
  note: string;
}

export const REGISTRY: Record<Need, ModelEntry> = {
  // Cheap drafts, reference-locked. Seedream EDIT (not text-to-image).
  "image/standard": {
    slug: "fal-ai/bytedance/seedream/v4.5/edit",
    unit: "image",
    unitCostCents: 4,
    async: false,
    refShape: "image_urls",
    textToImage: false,
    note: "Seedream 4.5 EDIT - cheap reference-locked drafts + pipeline testing.",
  },
  // Premium, reference-locked, up to 14 refs, 1K/2K/4K. Nano Banana Pro EDIT.
  "image/hero": {
    slug: "fal-ai/nano-banana-pro/edit",
    unit: "image",
    unitCostCents: 15,
    async: false,
    refShape: "image_urls",
    textToImage: false,
    note: "Nano Banana Pro EDIT - hero reference-locked fidelity, multi-reference identity lock.",
  },
  // Region edits / masking. GPT Image 2 edit (supports mask_url).
  "image/edit": {
    slug: "openai/gpt-image-2/edit",
    unit: "image",
    unitCostCents: 15,
    async: false,
    refShape: "image_urls",
    textToImage: false,
    note: "GPT Image 2 edit - precise region edits / inpaint with optional mask_url.",
  },
  // REPLACE (item 6): swap the product(s) into an existing source still, preserving the source's
  // pose/scene/lighting. Nano Banana Pro edit, multi-reference: source is the scene to keep, the
  // product(s) are inserted. The compose layer assigns roles (source = Image 1, products follow).
  "image/replace": {
    slug: "fal-ai/nano-banana-pro/edit",
    unit: "image",
    unitCostCents: 15,
    async: false,
    refShape: "image_urls",
    textToImage: false,
    note: "Nano Banana Pro EDIT - product swap into a source still, scene preserved.",
  },
  // Garment worn on a model. FASHN try-on.
  tryon: {
    slug: "fal-ai/fashn/tryon/v1.6",
    unit: "image",
    unitCostCents: 8,
    async: false,
    refShape: "tryon",
    textToImage: false,
    note: "FASHN v1.6 try-on - garment_image worn on model_image.",
  },
  // Background removal / garment clean.
  "bg-remove": {
    slug: "fal-ai/bria/background/remove",
    unit: "image",
    unitCostCents: 2,
    async: false,
    refShape: "image_url",
    textToImage: false,
    note: "Bria background remove.",
  },
  // STANDARD video, i2v anchored to the approved still (start_image_url).
  "video/standard": {
    slug: "fal-ai/kling-video/v3/pro/image-to-video",
    unit: "second",
    unitCostCents: 11.2,
    async: true,
    refShape: "start_image",
    textToImage: false,
    note: "Kling v3 pro i2v - anchored to the approved still as the first frame.",
  },
  // REPLACE-INTO-VIDEO (item 6): the product is first swapped into the source's frame (image/replace),
  // then this i2v anchors that swapped still as the first frame so the product stays locked across
  // frames. Capability note: motion is re-synthesized by i2v, not lifted frame-exact from the source
  // (no production video-to-video product-swap slug available); documented as a gap.
  "video/replace": {
    slug: "fal-ai/kling-video/v3/pro/image-to-video",
    unit: "second",
    unitCostCents: 11.2,
    async: true,
    refShape: "start_image",
    textToImage: false,
    note: "Kling v3 pro i2v - anchored to the product-swapped still; preserves the product across frames.",
  },
  // HERO video, premium i2v. Slug verified-live before first spend (Phase D).
  "video/hero": {
    slug: "fal-ai/veo3.1",
    unit: "second",
    unitCostCents: 40,
    async: true,
    refShape: "start_image",
    textToImage: false,
    note: "Veo 3.1 i2v - premium hero motion. Verify input field live before first spend.",
  },
  // Video upscale.
  "upscale/video": {
    slug: "fal-ai/topaz/upscale/video",
    unit: "second",
    unitCostCents: 8,
    async: true,
    refShape: "image_url",
    textToImage: false,
    note: "Topaz video upscale.",
  },
};

export function lookup(need: Need): ModelEntry {
  const entry = REGISTRY[need];
  if (!entry) throw new Error(`No model registered for need "${need}"`);
  return entry;
}

export function isAsyncNeed(need: Need): boolean {
  return lookup(need).async;
}

// v2 GUARD: a job that carries a product reference must never resolve to a text-to-image slug.
// Call this in the router before submitting. Throws loudly so the red-lehenga failure is impossible.
export function assertReferenceCapable(need: Need): ModelEntry {
  const entry = lookup(need);
  if (entry.textToImage || entry.refShape === "none") {
    throw new Error(
      `FIDELITY GUARD: need "${need}" resolved to text-to-image slug "${entry.slug}". ` +
        `A product generation must route to a reference-capable edit/try-on slug.`
    );
  }
  return entry;
}
