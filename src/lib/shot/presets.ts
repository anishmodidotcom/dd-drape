// Preset library (Section 8). Each preset is a one-tap full shot spec: a labelled, tagged partial
// ShotSpec that fills the model, makeup, hair, pose, background, lighting, framing, vibe, and
// default format. The wizard merges a preset over the chosen category/subType.

import type { ShotSpec, Category, Region } from "./spec";

export interface Preset {
  id: string;
  label: string;
  description: string;
  categoryTag: Category | "any";
  regionTag: Region | "any";
  /** Spec fields the preset sets; category/subType/referenceImagePaths come from the wizard. */
  spec: Partial<Omit<ShotSpec, "category" | "subType" | "referenceImagePaths">>;
}

export const PRESETS: Preset[] = [
  {
    id: "marketplace-clean",
    label: "Marketplace clean",
    description: "Clinical ecommerce on pure white. Built for Myntra and Amazon listings.",
    categoryTag: "apparel",
    regionTag: "any",
    spec: {
      shotType: "on-model-full",
      model: { ethnicity: "south-asian-medium", body: "mid-size" },
      makeup: "natural-fresh",
      hair: "open",
      pose: "s-curve",
      background: "white",
      lighting: "soft-two-zone",
      framing: "full-length",
      vibe: "clinical-ecom",
      format: "portrait-3-4",
      quality: "hero",
    },
  },
  {
    id: "festive-editorial",
    label: "Festive editorial",
    description: "Warm diya light in a heritage interior. Festive, dewy, India-first.",
    categoryTag: "apparel",
    regionTag: "india",
    spec: {
      shotType: "lifestyle",
      model: { ethnicity: "south-asian-deep", body: "slim" },
      makeup: "dewy",
      hair: "open",
      pose: "s-curve",
      background: "heritage-interior",
      lighting: "diya-warm-tungsten",
      framing: "three-quarter",
      vibe: "festive",
      region: "india",
      format: "ig-post",
      quality: "hero",
    },
  },
  {
    id: "quiet-luxury",
    label: "Quiet luxury",
    description: "Neutral palette, soft window light, restrained and premium.",
    categoryTag: "any",
    regionTag: "any",
    spec: {
      shotType: "on-model-full",
      model: { ethnicity: "mixed", body: "slim" },
      makeup: "natural-fresh",
      hair: "sleek",
      pose: "hand-to-collarbone",
      background: "light-grey",
      lighting: "natural-golden-hour",
      framing: "three-quarter",
      vibe: "quiet-luxury",
      format: "free",
      quality: "hero",
    },
  },
  {
    id: "bridal-regal",
    label: "Bridal regal",
    description: "Heavy kohl, chiaroscuro, seated and regal in a heritage setting.",
    categoryTag: "apparel",
    regionTag: "india",
    spec: {
      shotType: "lifestyle",
      model: { ethnicity: "south-asian-medium", body: "mid-size", bridalArchetype: true },
      makeup: "heavy-kohl-bridal",
      hair: "updo",
      pose: "seated-regal",
      background: "heritage-interior",
      lighting: "rembrandt",
      framing: "three-quarter",
      vibe: "bridal",
      region: "india",
      format: "ig-post",
      quality: "hero",
    },
  },
  {
    id: "streetwear-fusion",
    label: "Streetwear fusion",
    description: "Urban street, natural light, walking. Gen-Z register.",
    categoryTag: "apparel",
    regionTag: "any",
    spec: {
      shotType: "lifestyle",
      model: { ethnicity: "north-east-indian", body: "slim", ageRange: "20s" },
      makeup: "natural-fresh",
      hair: "open",
      pose: "walking",
      background: "urban-street",
      lighting: "natural-golden-hour",
      framing: "full-length",
      vibe: "streetwear",
      format: "ig-post",
      quality: "hero",
    },
  },
  {
    id: "demi-fine-everyday",
    label: "Demi-fine everyday",
    description: "On-model neck and ear crop with a sparkle spot. Jewellery, review-aware.",
    categoryTag: "jewellery",
    regionTag: "any",
    spec: {
      shotType: "detail-macro",
      model: { ethnicity: "south-asian-fair", demiFineEveryday: true },
      makeup: "natural-fresh",
      hair: "updo",
      pose: "neck-decollete-crop",
      background: "light-grey",
      lighting: "diffused-tent-sparkle",
      framing: "close-up-portrait",
      vibe: "demi-fine-everyday",
      format: "ig-square",
      quality: "hero",
    },
  },
];

export function presetsForCategory(category: Category): Preset[] {
  return PRESETS.filter((p) => p.categoryTag === "any" || p.categoryTag === category);
}

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
