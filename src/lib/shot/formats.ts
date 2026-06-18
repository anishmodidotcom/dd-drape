// Output sizing (Section 6.3, simplified). Standard dimensions + the common social presets.
// No marketplace-specific presets in v2.

export interface FormatPreset {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  group: "standard" | "social";
}

export const FORMATS: FormatPreset[] = [
  // Standard dimensions
  { id: "square", label: "Square", ratio: "1:1", width: 1500, height: 1500, group: "standard" },
  { id: "portrait-3-4", label: "Portrait 3:4", ratio: "3:4", width: 1500, height: 2000, group: "standard" },
  { id: "portrait-4-5", label: "Portrait 4:5", ratio: "4:5", width: 1500, height: 1875, group: "standard" },
  { id: "story", label: "Story 9:16", ratio: "9:16", width: 1080, height: 1920, group: "standard" },
  { id: "landscape", label: "Landscape 16:9", ratio: "16:9", width: 1920, height: 1080, group: "standard" },
  { id: "free", label: "Free", ratio: "free", width: 2048, height: 2048, group: "standard" },
  // Social presets
  { id: "ig-post", label: "Instagram post 4:5", ratio: "4:5", width: 1080, height: 1350, group: "social" },
  { id: "ig-story", label: "Instagram story 9:16", ratio: "9:16", width: 1080, height: 1920, group: "social" },
  { id: "ig-square", label: "Instagram square 1:1", ratio: "1:1", width: 1080, height: 1080, group: "social" },
];

export const DEFAULT_FORMAT = "portrait-3-4";

export function getFormat(id: string | undefined): FormatPreset {
  return FORMATS.find((f) => f.id === id) ?? FORMATS.find((f) => f.id === DEFAULT_FORMAT)!;
}
