// Deterministic model-generation prompt builder. Pure + testable. Carries the realism bar and the
// anti-slop negatives (a model is a person, not the user's product, so this is text-to-image for
// the base angle; identity is then locked across angles by conditioning on the first image).

import { ANTI_SLOP_NEGATIVE, REALISM_POSITIVE } from "@/lib/director/prompts";
import type { ModelInputs } from "./schema";

const FIELD_TEXT: { key: keyof ModelInputs; phrase: (v: string) => string }[] = [
  { key: "gender", phrase: (v) => `${v}` },
  { key: "ethnicity", phrase: (v) => `${v.replace(/-/g, " ")}` },
  { key: "ageRange", phrase: (v) => `in their ${v.replace("+", "s and older")}` },
  { key: "bodyType", phrase: (v) => `${v.replace(/-/g, " ")} build` },
  { key: "heightImpression", phrase: (v) => `${v} height` },
  { key: "skinTone", phrase: (v) => `${v} skin tone` },
  { key: "faceShape", phrase: (v) => `${v} face` },
  { key: "hairColor", phrase: (v) => `${v} hair` },
  { key: "hairLength", phrase: (v) => `${v} length` },
  { key: "hairstyle", phrase: (v) => `${v}` },
  { key: "eyeColor", phrase: (v) => `${v} eyes` },
  { key: "distinctiveFeatures", phrase: (v) => v },
  { key: "expression", phrase: (v) => `a ${v} expression` },
  { key: "vibe", phrase: (v) => `${v} vibe` },
];

// Builds the identity description shared across all four angles.
export function buildModelIdentity(inputs: ModelInputs): string {
  const parts: string[] = [];
  for (const f of FIELD_TEXT) {
    const v = inputs[f.key];
    if (v && String(v).trim()) parts.push(f.phrase(String(v).trim()));
  }
  let identity = parts.length ? `A fashion model: ${parts.join(", ")}.` : "A fashion model.";
  if (inputs.describe && inputs.describe.trim()) {
    identity += ` ${inputs.describe.trim()}.`;
  }
  return identity;
}

// Full prompt for one angle. `angleInstruction` comes from MODEL_ANGLES.
export function buildModelPrompt(inputs: ModelInputs, angleInstruction: string): string {
  return [
    buildModelIdentity(inputs),
    `${angleInstruction}.`,
    "Plain pure white seamless studio background, neutral simple styling, even soft studio lighting.",
    REALISM_POSITIVE + ".",
    "The SAME person across every shot: identical face, hair, body and skin tone.",
  ].join(" ");
}

export const MODEL_NEGATIVE = ANTI_SLOP_NEGATIVE + ", busy background, props, text, watermark";
