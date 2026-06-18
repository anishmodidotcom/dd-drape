// Fashion-studio loading personality (Phase E). Real-feeling staged progress + rotating, tasteful
// studio-vibe lines for the 15 to 60s+ generation jobs. No em dashes in any copy.

export interface LoadStage {
  id: string;
  label: string;
}

export const STAGES: LoadStage[] = [
  { id: "analyze", label: "Analyzing your piece" },
  { id: "cast", label: "Casting the model" },
  { id: "light", label: "Setting the lights" },
  { id: "shoot", label: "Shooting" },
  { id: "retouch", label: "Retouching" },
];

export const VIDEO_STAGES: LoadStage[] = [
  { id: "frame", label: "Locking the first frame" },
  { id: "block", label: "Blocking the motion" },
  { id: "roll", label: "Rolling camera" },
  { id: "grade", label: "Colour grading" },
];

// Tasteful, premium-witty. Rotated while a job runs.
export const LOADING_LINES = [
  "Steaming the fabric...",
  "Adjusting the key light...",
  "Telling the model to relax their shoulders...",
  "Finding the golden hour...",
  "Bribing the stylist for one more look...",
  "Chasing the perfect crease out of frame...",
  "Checking the hem falls just right...",
  "Dialing in the catchlight...",
  "Sweeping a stray thread off the lens...",
];

// Time-based stage progression: a stage roughly every few seconds, holding on the last stage
// (Retouching) until the job actually completes. Pure + testable.
export function stageIndexForElapsed(ms: number, stageCount: number, perStageMs = 6000): number {
  const idx = Math.floor(ms / perStageMs);
  return Math.min(idx, stageCount - 1);
}

export function lineForElapsed(ms: number, rotateMs = 3500): string {
  const i = Math.floor(ms / rotateMs) % LOADING_LINES.length;
  return LOADING_LINES[i];
}
