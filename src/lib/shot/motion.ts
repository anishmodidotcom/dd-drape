// Motion presets and the video (i2v) prompt builder. Video is always anchored to a generated
// still as the first frame (i2v beats t2v for product work). Motion must be described FULLY:
// what moves, what stays rigid, and the camera path. Vague motion is the #1 cause of bad video.

import type { ShotSpec, Category } from "./spec";

export interface MotionPreset {
  id: string;
  label: string;
  /** What moves and how. */
  motion: string;
  /** Camera path. */
  camera: string;
  /** Product categories this motion suits (M4: filter by category). */
  categories: Category[];
}

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "model-turn",
    label: "Model turn",
    motion: "The model turns slowly from three-quarter to face the camera, a soft natural smile.",
    camera: "The camera holds steady, a gentle push-in.",
    categories: ["apparel", "accessory"],
  },
  {
    id: "walk",
    label: "Walk toward camera",
    motion: "The model walks forward in a relaxed stride, fabric moving naturally with each step.",
    camera: "The camera tracks back at walking pace, eye level.",
    categories: ["apparel", "accessory"],
  },
  {
    id: "lehenga-twirl",
    label: "Garment twirl",
    motion: "The model twirls once so the garment flares fully, then settles.",
    camera: "The camera orbits slightly to follow the twirl.",
    categories: ["apparel"],
  },
  {
    id: "earring-adjust",
    label: "Adjust earring",
    motion:
      "The model raises one hand and gently adjusts an earring, head tilted to expose the ear. The earring stays rigid, undistorted, and does not bend.",
    camera: "The camera holds a close, steady frame on the ear and jaw.",
    categories: ["jewellery"],
  },
  {
    id: "ring-turn",
    label: "Ring turn",
    motion:
      "The hand rotates slowly to catch the light on the ring. The ring and stone stay rigid, undistorted, and do not bend.",
    camera: "The camera holds a macro frame, a slow subtle push-in.",
    categories: ["jewellery"],
  },
  {
    id: "subtle-sway",
    label: "Subtle sway",
    motion: "The model sways almost imperceptibly with relaxed breathing, fabric barely shifting.",
    camera: "The camera is locked off, no movement.",
    categories: ["apparel", "accessory", "jewellery"],
  },
];

export function getMotionPreset(id: string | undefined): MotionPreset {
  return MOTION_PRESETS.find((m) => m.id === id) ?? MOTION_PRESETS[0];
}

export function motionsForCategory(category: Category): MotionPreset[] {
  return MOTION_PRESETS.filter((m) => m.categories.includes(category));
}

// Builds the full i2v motion prompt. Rigid items (jewellery, watches, eyewear, bags) get an
// explicit non-distortion clause.
const RIGID_CATEGORIES: Category[] = ["jewellery", "accessory"];

export function buildMotionPrompt(spec: ShotSpec, presetId: string | undefined): string {
  const preset = getMotionPreset(presetId);
  const parts = [preset.motion, preset.camera];

  if (RIGID_CATEGORIES.includes(spec.category)) {
    parts.push(
      "The product stays completely rigid, undistorted, and does not bend, warp, or change shape."
    );
  } else {
    parts.push(
      "The garment keeps its exact colour, print, and detailing throughout, with natural fabric motion only."
    );
  }
  parts.push(
    "Keep the clip short and natural. Lifelike, real motion. No melting hands, no warping, no uncanny movement."
  );
  return parts.join(" ");
}
