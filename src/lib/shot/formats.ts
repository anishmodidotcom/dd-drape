// Output sizing (Section 6.3 / MN4): one clean list of DISTINCT ratios. No duplicate entries for
// the same aspect ratio (the IG-* presets were the same ratios listed twice).

export interface FormatPreset {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

export const FORMATS: FormatPreset[] = [
  { id: "square", label: "Square 1:1", ratio: "1:1", width: 1500, height: 1500 },
  { id: "portrait-4-5", label: "Portrait 4:5", ratio: "4:5", width: 1500, height: 1875 },
  { id: "portrait-3-4", label: "Portrait 3:4", ratio: "3:4", width: 1500, height: 2000 },
  { id: "story", label: "Story 9:16", ratio: "9:16", width: 1080, height: 1920 },
  { id: "landscape", label: "Landscape 16:9", ratio: "16:9", width: 1920, height: 1080 },
  { id: "free", label: "Free", ratio: "free", width: 2048, height: 2048 },
];

export const DEFAULT_FORMAT = "portrait-3-4";

export function getFormat(id: string | undefined): FormatPreset {
  return FORMATS.find((f) => f.id === id) ?? FORMATS.find((f) => f.id === DEFAULT_FORMAT)!;
}
