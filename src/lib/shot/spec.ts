// ShotSpec: the structured description of the shot a user wants. The wizard (presets or advanced)
// produces one of these; the compose layer turns it into a fal generation request. Every field is
// optional except category/subType/shotType so presets can fill a complete spec and advanced mode
// can override any axis.

import type { Category, ShotType } from "@/lib/engine/tier";

export type { Category, ShotType };

// --- Option vocabularies (Section 7.4 advanced controls). Used by the UI and the prompt builder.
// International-first and deliberately broad: many tones and regional looks, even visually similar
// ones, so the casting net is wide. Free text can always override any of these.
export const ETHNICITIES = [
  "south-asian-fair",
  "south-asian-medium",
  "south-asian-wheatish",
  "south-asian-dusky",
  "south-asian-deep",
  "south-indian",
  "north-indian",
  "north-east-indian",
  "indo-caribbean",
  "pakistani",
  "bangladeshi",
  "sri-lankan",
  "nepali",
  "middle-eastern",
  "persian",
  "arab",
  "turkish",
  "east-asian",
  "chinese",
  "japanese",
  "korean",
  "southeast-asian",
  "filipino",
  "thai",
  "vietnamese",
  "indonesian",
  "black-african",
  "black-african-deep",
  "black-american",
  "afro-caribbean",
  "ethiopian-somali",
  "white",
  "white-european",
  "scandinavian",
  "mediterranean",
  "slavic",
  "latina",
  "latino-mestizo",
  "afro-latina",
  "indigenous-american",
  "pacific-islander",
  "central-asian",
  "mixed",
  "ambiguous-cosmopolitan",
] as const;
export type Ethnicity = (typeof ETHNICITIES)[number];

// Skin tone as an independent axis (a given ethnicity spans tones).
export const SKIN_TONES = ["porcelain", "fair", "light", "medium", "olive", "tan", "brown", "deep", "rich-ebony"] as const;
export type SkinTone = (typeof SKIN_TONES)[number];

export const BODIES = ["slim", "straight", "athletic", "mid-size", "curvy", "plus-curvy", "petite", "tall-statuesque", "mature-40s", "mature-50s-plus"] as const;
export type Body = (typeof BODIES)[number];

export const AGE_RANGES = ["teens", "20s", "30s", "40s", "50s", "60s-plus"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export const GENDERS = ["women", "men", "unisex", "non-binary", "kids"] as const;
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
  skinTone?: SkinTone;
  body?: Body;
  heightCm?: number;
  ageRange?: AgeRange | string; // typed presets, free text allowed
  gender?: Gender;
  bridalArchetype?: boolean;
  demiFineEveryday?: boolean;
  /** Free-text identity description; folded into the casting prompt. */
  describe?: string;
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

  /**
   * Storage paths of the product reference image(s). Each entry is a DISTINCT product article to be
   * preserved and composed together onto one model (top + bottom + jewellery, etc.). One entry is
   * the common single-product case. Item 2 (multi-product).
   */
  referenceImagePaths: string[];

  /** Optional reference vibe image/video path the user uploaded ("the look I want"). */
  vibeReferencePath?: string;

  /** Saved or uploaded model identity reference image paths. Enables identity-locked composition. */
  modelImagePaths?: string[];

  /** Free-text brief the user typed; the director folds it across controls (first-class input). */
  freeBrief?: string;

  /**
   * Per-control free text (item 4): control id -> the user's own words for that control (e.g.
   * { lighting: "blown-out overexposed flash", pose: "mid-stride looking back" }). The director
   * treats these as authoritative and may override the matching structured selection.
   */
  freeText?: Record<string, string>;

  /** Item 5: number of output frames for a directed shoot (1..MAX_OUTPUTS). Defaults to 1. */
  outputCount?: number;
  /** Item 5: vary the model across the set (a casting board) vs the same model in every frame. */
  variateModel?: boolean;

  /**
   * Item 6 (Replace): swap the product(s) into an existing source still or clip, preserving the
   * source's pose/scene/lighting/motion. Exactly one of these is set for a replace request.
   */
  replace?: { sourceImagePath?: string; sourceVideoPath?: string };

  /** Item 8: persist the uploaded product(s) to the user's collection for reuse. */
  saveProduct?: boolean;

  video?: VideoSpec;

  /** Provenance: embed the visible "Created with AI" label on the output. */
  aiLabel?: boolean;
}

/** Hard cap on a single directed shoot (item 5). Keeps cost + latency bounded. */
export const MAX_OUTPUTS = 6;
/** Hard cap on distinct products composed into one shot (item 2). */
export const MAX_PRODUCTS = 5;

// M4: which poses make sense for which product category. A shirt must never offer an earring pose.
export const POSE_CATEGORIES: Record<Pose, Category[]> = {
  "s-curve": ["apparel", "accessory"],
  walking: ["apparel", "accessory"],
  twirl: ["apparel"],
  "hand-to-collarbone": ["apparel", "accessory", "jewellery"],
  "hand-to-face": ["apparel", "accessory", "jewellery"],
  "seated-regal": ["apparel", "accessory", "jewellery"],
  "neck-decollete-crop": ["jewellery"],
  "ear-profile-crop": ["jewellery"],
  "hand-ring-crop": ["jewellery", "accessory"],
  "candid-laughing": ["apparel", "accessory", "jewellery"],
  "over-shoulder-back": ["apparel", "accessory"],
  "adjusting-earring": ["jewellery"],
};

export function posesForCategory(category: Category): Pose[] {
  return POSES.filter((p) => POSE_CATEGORIES[p].includes(category));
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
