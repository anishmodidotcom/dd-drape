// Compose: turn a ShotSpec into a fal generation request. This is where product fidelity is
// enforced. Generation is reference-locked (image-to-image), never text-to-image: the uploaded
// product is passed as a reference image and the prompt instructs the model to PRESERVE its exact
// details and never reinvent them.

import type { Tier } from "@/lib/engine/tier";
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

// Humanize any ethnicity id we don't have a hand-written line for (the taxonomy is large and grows).
function humanizeEthnicity(id: string): string {
  const t = id.replace(/-/g, " ");
  return `a ${t} model`;
}
function modelClause(spec: ShotSpec): string {
  const m = spec.model;
  if (!m) return "";
  const parts: string[] = [];
  if (m.ethnicity) parts.push(ETHNICITY_TEXT[m.ethnicity] ?? humanizeEthnicity(m.ethnicity));
  else parts.push("a model");
  if (m.skinTone) parts.push(`${m.skinTone.replace(/-/g, " ")} skin tone`);
  if (m.body) parts.push(BODY_TEXT[m.body] ?? `${m.body.replace(/-/g, " ")} build`);
  if (m.ageRange) parts.push(`age ${m.ageRange}`);
  if (m.gender && m.gender !== "women") parts.push(String(m.gender));
  if (m.bridalArchetype) parts.push("styled as a bride");
  if (m.demiFineEveryday) parts.push("an everyday, approachable look");
  if (m.describe) parts.push(m.describe);
  return parts.filter(Boolean).join(", ");
}

// The single-subject lock. The recurring failure with multi-reference edit models is a COLLAGE:
// the output shows the reference photos themselves laid side by side instead of one cohesive frame.
// This clause forbids that explicitly and is appended whenever more than one reference is attached
// or a model identity is used (item 1 root-cause fix).
export const ANTI_COLLAGE =
  "Produce ONE single cohesive photograph of one scene. Never depict the reference images " +
  "themselves and never place them in the output. No collage, no grid, no split screen, no " +
  "side-by-side panels, no picture-in-picture, no contact sheet, no before-and-after, no duplicated " +
  "subject. The reference images are guidance only.";

/**
 * Names each attached reference image by position so a multi-reference edit model knows the ROLE of
 * each (preserve the product(s); apply the identity; keep the source scene) and produces one frame.
 * Order must match the router's image_urls ordering in route.ts.
 */
export function referenceRolesClause(opts: {
  productCount: number;
  hasIdentity: boolean;
  isReplace?: boolean;
}): string {
  const { productCount, hasIdentity, isReplace } = opts;
  const lines: string[] = [];
  let i = 1;
  if (isReplace) {
    lines.push(
      `Image ${i++} is the SOURCE scene to keep exactly: preserve its pose, composition, person, ` +
        "background, lighting and mood unchanged."
    );
  }
  if (productCount === 1) {
    lines.push(`Image ${i++} is the exact product to preserve and place into the scene.`);
  } else {
    for (let p = 0; p < productCount; p++) {
      lines.push(
        `Image ${i++} is product ${p + 1} of ${productCount}: preserve it exactly (colour, fabric, ` +
          "print, construction) and place it on the model together with the other products."
      );
    }
    lines.push(
      `All ${productCount} products must appear on the SAME single model in one coherent outfit, ` +
        "each preserved faithfully and simultaneously."
    );
  }
  if (hasIdentity) {
    lines.push(
      `Image ${i++} is the MODEL IDENTITY: the output person must have this exact face, hair, body ` +
        "and skin tone. Use it only to define who the model is; do not show this photo in the output."
    );
  }
  lines.push(ANTI_COLLAGE);
  return lines.join(" ");
}

// Builds the natural-language prompt. No em dashes (brand rule).
export function buildPrompt(spec: ShotSpec): string {
  const sentences: string[] = [];

  const productCount = spec.referenceImagePaths?.length || 1;
  const hasIdentity = !!(spec.modelImagePaths && spec.modelImagePaths.length > 0);
  const isReplace = !!spec.replace?.sourceImagePath;

  const isOnModel =
    spec.shotType === "on-model-full" ||
    spec.shotType === "lifestyle" ||
    (spec.framing === "full-length" ||
      spec.framing === "three-quarter" ||
      spec.framing === "close-up-portrait");

  // Replace request: keep the source, swap only the product(s).
  if (isReplace) {
    sentences.push(
      productCount > 1
        ? "Swap the products shown in the reference images into the source scene, replacing the corresponding worn items while keeping everything else identical."
        : "Swap the product shown in the reference image into the source scene, replacing the corresponding worn item while keeping everything else identical."
    );
    sentences.push(fidelityClause(spec.category));
    sentences.push(referenceRolesClause({ productCount, hasIdentity, isReplace: true }));
    sentences.push(
      "Natural, realistic result with lifelike skin and hands. No plastic skin, no distortion, no artificial smoothness."
    );
    return sentences.join(" ");
  }

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

  // Reference roles + single-subject lock whenever more than one reference is attached or a model
  // identity is used. This is the structural fix for the saved-model collage (item 1) and the
  // multi-product composition instruction (item 2).
  if (productCount > 1 || hasIdentity) {
    sentences.push(referenceRolesClause({ productCount, hasIdentity }));
  }

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
        "Oviya enhances and places your piece, it does not fabricate facet-level detail. For a hero macro of this item, we recommend uploading a real macro shot to enhance.",
    };
  }
  return { blocked: false };
}

// NOTE: the legacy `buildGeneration` (v1 routing + falInput assembly) was removed in the audit-fix
// pass. Routing/pricing now live in src/lib/shot/plan.ts (planRoute/planNeed), and the actual fal
// body is assembled by the director (compose -> route). buildPrompt and redPolicy remain in use by
// the deterministic fallback and the plan.
