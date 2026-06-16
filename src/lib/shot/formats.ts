// Output format presets (Section 7.4 Step 3). Marketplace, social, and portfolio targets.

export interface FormatPreset {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  note: string;
}

export const FORMATS: FormatPreset[] = [
  { id: "myntra", label: "Myntra", ratio: "3:4", width: 1500, height: 2000, note: "3:4 portrait" },
  {
    id: "amazon-in",
    label: "Amazon India",
    ratio: "1:1",
    width: 2000,
    height: 2000,
    note: "Pure white #FFFFFF, product fills 85%",
  },
  { id: "meesho", label: "Meesho", ratio: "1:1", width: 1500, height: 1500, note: "1:1, 1500px+" },
  {
    id: "instagram-portrait",
    label: "Instagram 4:5",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    note: "Feed portrait",
  },
  {
    id: "instagram-square",
    label: "Instagram 1:1",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    note: "Feed square",
  },
  {
    id: "instagram-story",
    label: "Instagram Story 9:16",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    note: "Story / Reel",
  },
  {
    id: "portfolio",
    label: "Portfolio / Editorial",
    ratio: "free",
    width: 2048,
    height: 2560,
    note: "Free ratio, high resolution",
  },
];

export const DEFAULT_FORMAT = "myntra";

export function getFormat(id: string | undefined): FormatPreset {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}
