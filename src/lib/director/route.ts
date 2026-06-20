// Stage 3 - Route (deterministic). Maps a Composition's model_route to the fal slug and attaches
// the product image(s) to the CORRECT input field for that slug. Validates, in code, that a
// reference image is present in the built body before submit. If absent, throws - we never
// silently send a text-only request. This is the structural half of the v2 fidelity fix.

import { assertReferenceCapable, type ModelEntry, type Need } from "@/lib/engine/registry";
import type { Composition, ReferenceImages, RoutedGeneration } from "./schema";

function attachReference(
  entry: ModelEntry,
  refs: ReferenceImages,
  falInput: Record<string, unknown>
): void {
  const product = refs.product ?? [];
  if (product.length === 0) {
    throw new Error("FIDELITY GUARD: no product reference image provided to the router");
  }

  switch (entry.refShape) {
    case "image_urls": {
      // Edit models accept up to 14 references. Order encodes roles, and compose's prompt names each
      // by position. Replace (item 6): the SOURCE still is Image 1 (the scene to keep), then the
      // products to swap in. Otherwise: products first (each a distinct article to preserve), then
      // the model identity, then a scene reference. The identity is an identity CONDITION, never a
      // panel to depict; the anti-collage prompt enforces a single cohesive subject.
      const urls = refs.replaceSource
        ? [refs.replaceSource, ...product, ...(refs.modelIdentity ?? [])]
        : [...product, ...(refs.modelIdentity ?? [])];
      if (refs.scene) urls.push(refs.scene);
      falInput.image_urls = urls;
      break;
    }
    case "image_url": {
      falInput.image_url = product[0];
      break;
    }
    case "start_image": {
      // i2v: the approved still (or product-swapped still for replace) is the start frame.
      falInput.start_image_url = refs.replaceSource ?? product[0];
      break;
    }
    case "tryon": {
      // FASHN: the garment is the product; the model is the identity reference (required).
      falInput.garment_image = product[0];
      if (!refs.modelIdentity || refs.modelIdentity.length === 0) {
        throw new Error("FIDELITY GUARD: try-on requires a model_image (saved model identity)");
      }
      falInput.model_image = refs.modelIdentity[0];
      break;
    }
    case "none":
      throw new Error("FIDELITY GUARD: model has no image input; cannot carry the product");
  }
}

// Verify the built body actually carries the product image in a known reference field.
function assertImageAttached(entry: ModelEntry, falInput: Record<string, unknown>): void {
  const has = (k: string) => {
    const v = falInput[k];
    return typeof v === "string" ? v.length > 0 : Array.isArray(v) && v.length > 0;
  };
  const ok =
    (entry.refShape === "image_urls" && has("image_urls")) ||
    (entry.refShape === "image_url" && has("image_url")) ||
    (entry.refShape === "start_image" && has("start_image_url")) ||
    (entry.refShape === "tryon" && has("garment_image") && has("model_image"));
  if (!ok) {
    throw new Error(
      `FIDELITY GUARD: built fal body for "${entry.slug}" is missing the product reference image`
    );
  }
}

export function route(composition: Composition, refs: ReferenceImages): RoutedGeneration {
  const need: Need = composition.model_route;
  // Guard 1: the slug must be reference-capable, never text-to-image.
  const entry = assertReferenceCapable(need);

  const p = composition.params ?? {};
  const falInput: Record<string, unknown> = {
    prompt: composition.positive_prompt,
    num_images: p.num_images ?? 1,
  };
  if (composition.negative_prompt) falInput.negative_prompt = composition.negative_prompt;
  if (p.resolution) falInput.resolution = p.resolution;
  if (p.image_size) falInput.image_size = p.image_size;
  if (p.aspect_ratio) falInput.aspect_ratio = p.aspect_ratio;
  if (typeof p.strength === "number") falInput.strength = p.strength;

  // Guard 2: attach the product to the correct field.
  attachReference(entry, refs, falInput);
  // Guard 3: verify it actually landed in the body before submit.
  assertImageAttached(entry, falInput);

  return {
    need,
    slug: entry.slug,
    falInput,
    fidelityLocks: composition.fidelity_locks ?? [],
  };
}
