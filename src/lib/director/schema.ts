// Director schemas: the structured JSON the Analyze and Compose stages produce.
// These are the contract between Claude (or the deterministic fallback) and the router.

import type { Need } from "@/lib/engine/registry";

// Stage 1 (Analyze): extracted product attributes. Any field not readable is null; values are
// returned exactly as observed, never translated. Cached on drape_products so re-generations
// skip re-analysis.
export interface ProductAnalysis {
  product_category: "apparel" | "jewellery" | "accessory" | null;
  garment_subtype: string | null;
  primary_color_name: string | null;
  primary_color_hex: string | null;
  secondary_colors: string[];
  fabric: string | null;
  weave_or_knit: string | null;
  sheerness: string | null;
  reflectivity: "matte" | "satin" | "metallic" | null;
  print_or_pattern: string | null;
  print_scale: string | null;
  embroidery_type: string | null;
  embellishments: string[];
  construction: {
    neckline: string | null;
    sleeve: string | null;
    hem: string | null;
    closures: string | null;
    fit: string | null;
    drape_behavior: string | null;
  };
  hardware: string[];
  text_or_logos: string[];
  jewellery: {
    metal_type: string | null;
    stone_type: string | null;
    setting: string | null;
    engraving_text: string | null;
  } | null;
  confidence: Record<string, number>;
  recommended_shot_types: string[];
  recommended_looks: { label: string; one_line_brief: string }[];
}

// Stage 2 (Compose): the generation plan.
export interface Composition {
  positive_prompt: string;
  negative_prompt: string;
  model_route: Need;
  params: {
    resolution?: "1K" | "2K" | "4K";
    num_images?: number;
    image_size?: { width: number; height: number };
    aspect_ratio?: string;
    strength?: number;
  };
  video_prompt?: string;
  fidelity_locks: string[];
  clarifying_questions?: string[];
}

// Stage 3 result (Route): the exact fal request, with the product image attached to the correct
// field and the slug guaranteed reference-capable.
export interface RoutedGeneration {
  need: Need;
  slug: string;
  falInput: Record<string, unknown>;
  fidelityLocks: string[];
}

// Reference image roles passed to the router. Order in the built image_urls array encodes roles,
// and the compose prompt names each by position.
export interface ReferenceImages {
  /** The exact product image URL(s) - one per distinct article (item 2). Always attached. */
  product: string[];
  /** Optional saved/uploaded model identity reference URL(s). */
  modelIdentity?: string[];
  /** Optional scene / vibe reference URL. */
  scene?: string;
  /** Replace (item 6): the source still to keep; products are swapped into it. Becomes Image 1. */
  replaceSource?: string;
}

// Fidelity-gate verdict (post-generation critique).
export interface FidelityVerdict {
  match: boolean;
  color_ok: boolean;
  pattern_ok: boolean;
  garment_ok: boolean;
  reasons: string[];
}

export function emptyAnalysis(): ProductAnalysis {
  return {
    product_category: null,
    garment_subtype: null,
    primary_color_name: null,
    primary_color_hex: null,
    secondary_colors: [],
    fabric: null,
    weave_or_knit: null,
    sheerness: null,
    reflectivity: null,
    print_or_pattern: null,
    print_scale: null,
    embroidery_type: null,
    embellishments: [],
    construction: {
      neckline: null,
      sleeve: null,
      hem: null,
      closures: null,
      fit: null,
      drape_behavior: null,
    },
    hardware: [],
    text_or_logos: [],
    jewellery: null,
    confidence: {},
    recommended_shot_types: [],
    recommended_looks: [],
  };
}
