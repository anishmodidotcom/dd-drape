// Directed-shoot planning (item 5). When a request asks for multiple outputs, the director imagines
// a coherent SHOOT, not N identical frames: pose, angle, framing and crop vary across the set like a
// real photographer working a look from several setups. This pure planner produces N art-directed
// frame specs from one base spec; it is deterministic (so cost is predictable and it is unit
// testable) and stays category-valid (a shirt never gets an earring pose).

import { MAX_OUTPUTS, posesForCategory, type Pose, type Framing, type ShotSpec } from "./spec";

interface Setup {
  framing: Framing;
  pose: Pose;
  shotType: ShotSpec["shotType"];
  note: string;
}

// Complementary setups, ordered for editorial flow: establish, move, detail, repeat with variation.
const SETUPS: Setup[] = [
  { framing: "full-length", pose: "s-curve", shotType: "on-model-full", note: "establishing full-length hero frame, model square to camera" },
  { framing: "three-quarter", pose: "walking", shotType: "lifestyle", note: "three-quarter frame with walking motion, slight low angle" },
  { framing: "close-up-portrait", pose: "hand-to-face", shotType: "lifestyle", note: "intimate beauty close-up, shallow depth of field" },
  { framing: "full-length", pose: "twirl", shotType: "on-model-full", note: "movement frame, the garment caught mid-motion" },
  { framing: "three-quarter", pose: "over-shoulder-back", shotType: "lifestyle", note: "over-the-shoulder frame showing the back, three-quarter turn" },
  { framing: "close-up-portrait", pose: "candid-laughing", shotType: "lifestyle", note: "candid editorial moment, natural expression" },
];

export interface ShootFrame {
  spec: ShotSpec;
  label: string;
}

export function clampOutputCount(n: number | undefined): number {
  const c = Math.floor(n ?? 1);
  if (!Number.isFinite(c) || c < 1) return 1;
  return Math.min(c, MAX_OUTPUTS);
}

export function planShootFrames(spec: ShotSpec, count: number): ShootFrame[] {
  const n = clampOutputCount(count);
  const validPoses = posesForCategory(spec.category);
  return Array.from({ length: n }, (_, i) => {
    const setup = SETUPS[i % SETUPS.length];
    // Keep the pose valid for the category; fall back to the user's pose or the first valid one.
    const pose = validPoses.includes(setup.pose) ? setup.pose : spec.pose ?? validPoses[0];
    const frameNote =
      `Frame ${i + 1} of ${n}: ${setup.note}.` +
      (spec.variateModel && !spec.modelImagePaths?.length ? " Cast a different model than the other frames." : " The same model as the other frames.");
    const frameSpec: ShotSpec = {
      ...spec,
      framing: setup.framing,
      shotType: setup.shotType,
      pose,
      outputCount: 1, // each frame is a single generation
      variateModel: undefined,
      freeText: { ...(spec.freeText ?? {}), frame: frameNote },
    };
    return { spec: frameSpec, label: setup.note };
  });
}
