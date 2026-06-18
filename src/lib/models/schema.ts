// Models studio: the creation inputs and the four reference angles.

export interface ModelInputs {
  ethnicity?: string; // reuse spec ETHNICITIES ids or free text
  ageRange?: string; // "20s", "30s", "40s+"
  bodyType?: string; // slim, mid-size, plus-curvy, petite, athletic
  heightImpression?: string; // petite, average, tall
  skinTone?: string; // fair, medium, deep, etc.
  faceShape?: string;
  expression?: string; // soft smile, neutral, confident
  hairColor?: string;
  hairLength?: string;
  hairstyle?: string;
  eyeColor?: string;
  distinctiveFeatures?: string; // freckles, beauty mark
  vibe?: string; // editorial, approachable, regal
  gender?: string; // women, men, unisex
  /** Free-text override/augment; folded into the generation prompt. */
  describe?: string;
}

// The four white-background angles, generated as one consistent identity.
export const MODEL_ANGLES = [
  { id: "front", label: "Front full", instruction: "full-length front view, standing straight, arms relaxed" },
  { id: "three-quarter", label: "Three-quarter", instruction: "full-length three-quarter turn" },
  { id: "side", label: "Side profile", instruction: "full-length side profile view" },
  { id: "portrait", label: "Close-up portrait", instruction: "head-and-shoulders close-up portrait" },
] as const;

export type ModelAngleId = (typeof MODEL_ANGLES)[number]["id"];

// Cost: 1 base angle (cheap text-to-image) + 3 identity-conditioned edit angles.
// 4 cents (Seedream t2i) + 3 x 15 cents (Nano Banana Pro edit) = 49 credits.
export const MODEL_CREATE_CREDITS = 49;

export interface ModelRow {
  id: string;
  user_id: string;
  name: string;
  inputs: ModelInputs;
  image_paths: string[];
  status: "ready" | "failed";
  created_at: string;
  updated_at: string;
}
