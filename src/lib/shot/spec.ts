// ShotSpec: the structured description of the shot a user wants. The wizard (presets or advanced)
// produces one of these; the compose layer turns it into a fal generation request. Every field is
// optional except category/subType/shotType so presets can fill a complete spec and advanced mode
// can override any axis.

import type { Category, ShotType } from "@/lib/engine/tier";

export type { Category, ShotType };

// --- Option vocabularies (Section 7.4 advanced controls). Used by the UI and the prompt builder.
export const ETHNICITIES = [
  "south-asian-medium",
  "south-asian-deep",
  "south-asian-fair",
  "south-indian",
  "north-east-indian",
  "white",
  "black",
  "east-asian",
  "latina",
  "mixed",
] as const;
export type Ethnicity = (typeof ETHNICITIES)[number];

export const BODIES = ["slim", "mid-size", "plus-curvy", "petite", "mature-40s"] as const;
export type Body = (typeof BODIES)[number];

export const GENDERS = ["women", "men", "unisex", "kids"] as const;
export type Gender = (typeof GENDERS)[number];

export const MAKEUP = ["natural-fresh", "dewy", "heavy-kohl-bridal", "editorial", "none"] as const;
export type Makeup = (typeof MAKEUP)[number];

export const HAIR = ["open", "updo", "braided", "sleek"] as const;
export type Hair = (typeof HAIR)[number];

export const POSES = [
  "s-curve",
  "walking",
  "twirl",
  "hand-to-collarbone",
  "hand-to-face",
  "seated-regal",
  "neck-decollete-crop",
  "ear-profile-crop",
  "hand-ring-crop",
  "candid-laughing",
  "over-shoulder-back",
  "adjusting-earring",
] as const;
export type Pose = (typeof POSES)[number];

export const BACKGROUNDS = [
  "white",
  "light-grey",
  "heritage-interior",
  "studio-coloured",
  "urban-street",
  "natural-outdoor",
  "festive-set",
] as const;
export type Background = (typeof BACKGROUNDS)[number];

export const LIGHTING = [
  "soft-two-zone",
  "butterfly-beauty",
  "rembrandt",
  "natural-golden-hour",
  "diya-warm-tungsten",
  "diffused-tent-sparkle",
] as const;
export type Lighting = (typeof LIGHTING)[number];

export const FRAMINGS = [
  "full-length",
  "three-quarter",
  "close-up-portrait",
  "flat-lay",
  "detail-macro",
  "ghost-mannequin",
] as const;
export type Framing = (typeof FRAMINGS)[number];

export const VIBES = [
  "festive",
  "bridal",
  "heritage-regal",
  "quiet-luxury",
  "minimal",
  "editorial",
  "boho",
  "streetwear",
  "demi-fine-everyday",
  "clinical-ecom",
] as const;
export type Vibe = (typeof VIBES)[number];

export type Region = "india" | "global";
export type Quality = "standard" | "hero";

export interface ModelSpec {
  ethnicity?: Ethnicity;
  body?: Body;
  heightCm?: number;
  ageRange?: string; // e.g. "20s", "30s", "40s+"
  gender?: Gender;
  bridalArchetype?: boolean;
  demiFineEveryday?: boolean;
}

export interface VideoSpec {
  enabled: boolean;
  motionPreset?: string; // id from motion.ts
  seconds?: number; // 5-8
}

export interface ShotSpec {
  category: Category;
  subType: string;
  shotType: ShotType;

  model?: ModelSpec;
  makeup?: Makeup;
  hair?: Hair;
  pose?: Pose;
  background?: Background;
  lighting?: Lighting;
  framing?: Framing;
  vibe?: Vibe;
  region?: Region;

  /** Output format preset id (formats.ts), e.g. "myntra", "amazon-in", "instagram-portrait". */
  format?: string;
  /** standard = cheapest model (Seedream), hero = max fidelity (Nano Banana Pro). */
  quality?: Quality;

  /** For colour-variant shots: the target colour described in words or a hex value. */
  colourVariant?: string;

  /** Storage paths (drape-outputs/uploads/...) of the uploaded product reference images. */
  referenceImagePaths: string[];

  /** Optional reference vibe image/video path the user uploaded ("the look I want"). */
  vibeReferencePath?: string;

  /** Saved-model identity reference image paths (Models studio). Enables the try-on route. */
  modelImagePaths?: string[];

  /** Free-text brief the user typed; Claude folds it across controls. */
  freeBrief?: string;

  video?: VideoSpec;

  /** Provenance: embed the visible "Created with AI" label on the output. */
  aiLabel?: boolean;
}

// The framing the user picks maps to a tiering shotType when the wizard does not set one directly.
export function framingToShotType(framing: Framing | undefined, fallback: ShotType): ShotType {
  switch (framing) {
    case "full-length":
    case "three-quarter":
      return "on-model-full";
    case "detail-macro":
    case "close-up-portrait":
      return "detail-macro";
    case "flat-lay":
    case "ghost-mannequin":
      return "flat-lay";
    default:
      return fallback;
  }
}
