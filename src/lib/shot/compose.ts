// Compose: turn a ShotSpec into a fal generation request. This is where product fidelity is
// enforced. Generation is reference-locked (image-to-image), never text-to-image: the uploaded
// product is passed as a reference image and the prompt instructs the model to PRESERVE its exact
// details and never reinvent them.

import type { Need } from "@/lib/engine/registry";
import { classifyTier, type Tier } from "@/lib/engine/tier";
import type { ShotSpec, Category } from "./spec";

// Human-readable fragments for each enum value, for natural prompt language.
const ETHNICITY_TEXT: Record<string, string> = {
  "south-asian-medium": "a South Asian model with medium skin tone",
  "south-asian-deep": "a South Asian model with deep skin tone",
  "south-asian-fair": "a South Asian model with fair skin tone",
  "south-indian": "a South Indian model",
  "north-east-indian": "a North East Indian model",
  white: "a White model",
  black: "a Black model",
  "east-asian": "an East Asian model",
  latina: "a Latina model",
  mixed: "a mixed-ethnicity model",
};
const BODY_TEXT: Record<string, string> = {
  slim: "slim build",
  "mid-size": "mid-size build",
  "plus-curvy": "plus-size curvy build",
  petite: "petite build",
  "mature-40s": "mature, 40s",
};
const MAKEUP_TEXT: Record<string, string> = {
  "natural-fresh": "natural fresh makeup",
  dewy: "dewy makeup",
  "heavy-kohl-bridal": "heavy kohl bridal makeup",
  editorial: "bold editorial makeup",
  none: "no makeup",
};
const HAIR_TEXT: Record<string, string> = {
  open: "hair worn open",
  updo: "hair in an updo that exposes the neck and ears",
  braided: "braided hair",
  sleek: "sleek styled hair",
};
const POSE_TEXT: Record<string, string> = {
  "s-curve": "standing in a relaxed S-curve with weight on one leg",
  walking: "walking in mid-stride",
  twirl: "mid-twirl so the garment flares",
  "hand-to-collarbone": "one hand resting at the collarbone",
  "hand-to-face": "a hand softly to the face",
  "seated-regal": "seated in a regal, upright pose",
  "neck-decollete-crop": "cropped to the neck and decolletage",
  "ear-profile-crop": "a profile crop framing the ear",
  "hand-ring-crop": "a close crop of the hand",
  "candid-laughing": "candidly laughing",
  "over-shoulder-back": "viewed over the shoulder showing the back",
  "adjusting-earring": "adjusting an earring",
};
const BACKGROUND_TEXT: Record<string, string> = {
  white: "a clean pure white #FFFFFF studio background",
  "light-grey": "a light grey seamless studio background",
  "heritage-interior": "a lived-in Indian heritage interior",
  "studio-coloured": "a coloured seamless studio backdrop",
  "urban-street": "an urban street setting",
  "natural-outdoor": "a natural outdoor setting",
  "festive-set": "a festive set with marigolds and diyas",
};
const LIGHTING_TEXT: Record<string, string> = {
  "soft-two-zone": "soft two-zone studio lighting",
  "butterfly-beauty": "butterfly beauty lighting",
  rembrandt: "dramatic Rembrandt lighting",
  "natural-golden-hour": "natural window light with a golden-hour rim",
  "diya-warm-tungsten": "warm tungsten and diya candlelight",
  "diffused-tent-sparkle": "a diffused light tent with a sparkle spot",
};
const FRAMING_TEXT: Record<string, string> = {
  "full-length": "full-length framing",
  "three-quarter": "three-quarter framing",
  "close-up-portrait": "a close-up portrait",
  "flat-lay": "a flat-lay composition",
  "detail-macro": "a macro detail crop",
  "ghost-mannequin": "a ghost-mannequin product composition with no visible body",
};
const VIBE_TEXT: Record<string, string> = {
  festive: "festive",
  bridal: "bridal",
  "heritage-regal": "heritage and regal",
  "quiet-luxury": "quiet luxury",
  minimal: "minimal",
  editorial: "editorial",
  boho: "boho",
  streetwear: "streetwear and fusion",
  "demi-fine-everyday": "demi-fine everyday",
  "clinical-ecom": "clean clinical ecommerce",
};

// The non-negotiable fidelity clause, tuned per category.
function fidelityClause(category: Category): string {
  if (category === "jewellery") {
    return (
      "Preserve the exact piece from the reference image: metal tone, every facet, gemstone " +
      "colour and cut, engravings and settings. Do not invent or alter any detail of the jewellery."
    );
  }
  if (category === "accessory") {
    return (
      "Preserve the exact accessory from the reference image: material, colour, hardware, logos, " +
      "stitching and texture. Do not redesign or alter the product."
    );
  }
  return (
    "Preserve the exact garment from the reference image: colour, fabric texture, weave, drape, " +
    "stitching, prints, embroidery, zari, mirror work and any logos. Do not reinvent the product; " +
    "reproduce it faithfully."
  );
}

function modelClause(spec: ShotSpec): string {
  const m = spec.model;
  if (!m) return "";
  const parts: string[] = [];
  if (m.ethnicity) parts.push(ETHNICITY_TEXT[m.ethnicity] ?? "a model");
  else parts.push("a model");
  if (m.body) parts.push(BODY_TEXT[m.body]);
  if (m.ageRange) parts.push(`age ${m.ageRange}`);
  if (m.bridalArchetype) parts.push("styled as a bride");
  if (m.demiFineEveryday) parts.push("an everyday, approachable look");
  return parts.filter(Boolean).join(", ");
}

// Builds the natural-language prompt. No em dashes (brand rule).
export function buildPrompt(spec: ShotSpec): string {
  const sentences: string[] = [];

  const isOnModel =
    spec.shotType === "on-model-full" ||
    spec.shotType === "lifestyle" ||
    (spec.framing === "full-length" ||
      spec.framing === "three-quarter" ||
      spec.framing === "close-up-portrait");

  // Subject sentence.
  if (isOnModel) {
    const model = modelClause(spec) || "a model";
    const pose = spec.pose ? POSE_TEXT[spec.pose] : "a natural editorial pose";
    sentences.push(`A premium fashion photograph of ${model}, ${pose}, wearing the product.`);
  } else if (spec.shotType === "colour-variant") {
    sentences.push(
      `A clean product photograph of the item recoloured to ${spec.colourVariant ?? "the requested colour"}, keeping its exact shape and detailing.`
    );
  } else {
    sentences.push("A clean, premium product photograph of the item.");
  }

  // Styling.
  const styling: string[] = [];
  if (spec.makeup && isOnModel) styling.push(MAKEUP_TEXT[spec.makeup]);
  if (spec.hair && isOnModel) styling.push(HAIR_TEXT[spec.hair]);
  if (styling.length) sentences.push(`The model has ${styling.join(" and ")}.`);

  // Scene.
  const scene: string[] = [];
  if (spec.background) scene.push(`Set against ${BACKGROUND_TEXT[spec.background]}`);
  if (spec.lighting) scene.push(`lit with ${LIGHTING_TEXT[spec.lighting]}`);
  if (spec.framing) scene.push(FRAMING_TEXT[spec.framing]);
  if (scene.length) sentences.push(`${scene.join(", ")}.`);

  // Mood.
  if (spec.vibe) sentences.push(`The mood is ${VIBE_TEXT[spec.vibe]}.`);

  // Fidelity clause, always last and emphatic.
  sentences.push(fidelityClause(spec.category));

  // Realism guardrail (the "AI tell" kills premium trust).
  sentences.push(
    "Natural, realistic result with lifelike skin and hands. No plastic skin, no distortion, no artificial smoothness."
  );

  return sentences.join(" ");
}

// RED-tier policy: decide whether a RED shot generates in enhancement mode or is blocked.
// We never fabricate facet-level hero detail. Macro/detail hero on jewellery (or complex apparel)
// is blocked with an honest message; other RED shots generate in enhancement mode.
export interface RedPolicy {
  blocked: boolean;
  message?: string;
}
export function redPolicy(spec: ShotSpec, tier: Tier): RedPolicy {
  if (tier !== "red") return { blocked: false };
  if (spec.shotType === "detail-macro") {
    return {
      blocked: true,
      message:
        "Drape enhances and places your piece, it does not fabricate facet-level detail. For a hero macro of this item, we recommend uploading a real macro shot to enhance.",
    };
  }
  return { blocked: false };
}

export interface Generation {
  need: Need;
  tier: Tier;
  /** When set, do not generate: refund and show this message (RED block). */
  blocked?: string;
  falInput: Record<string, unknown>;
  estimateExtras: { count?: number; seconds?: number };
}

// Choose the model NEED for the still and assemble fal input. referenceUrls are resolved,
// publicly fetchable URLs (signed Supabase URLs) for the uploaded product images.
export function buildGeneration(spec: ShotSpec, referenceUrls: string[]): Generation {
  const tier = classifyTier({
    category: spec.category,
    subType: spec.subType,
    shotType: spec.shotType,
  });

  const policy = redPolicy(spec, tier);
  const prompt = buildPrompt(spec);

  // Need selection:
  //   - quality 'standard' uses the cheapest model (Seedream) for testing / GREEN ecom.
  //   - quality 'hero' (default for fidelity) uses Nano Banana Pro, reference-locked.
  //   - background-swap / colour-variant / flat-lay are edits of the uploaded product.
  const isEdit =
    spec.shotType === "background-swap" ||
    spec.shotType === "colour-variant" ||
    spec.shotType === "flat-lay";

  let need: Need;
  if (spec.quality === "standard") {
    need = "image/standard";
  } else if (isEdit) {
    need = "image/edit";
  } else {
    need = "image/hero";
  }

  // fal input. Nano Banana Pro / edit accept image_urls (up to 14 references) + prompt.
  // Seedream standard accepts a prompt and, for reference-locked i2i, image_urls too.
  const falInput: Record<string, unknown> = {
    prompt,
    num_images: 1,
    output_format: "png",
  };
  if (referenceUrls.length) {
    falInput.image_urls = referenceUrls;
  }

  return {
    need,
    tier,
    blocked: policy.blocked ? policy.message : undefined,
    falInput,
    estimateExtras: { count: 1 },
  };
}
