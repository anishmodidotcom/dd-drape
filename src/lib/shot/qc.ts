// Tier-aware delivery copy and the AMBER QC checklist (Section 6 / 7.5).

import type { Tier } from "@/lib/engine/tier";

export interface TierPresentation {
  badge: string;
  tone: "success" | "caution" | "danger";
  headline: string;
  body: string;
}

export const TIER_PRESENTATION: Record<Tier, TierPresentation> = {
  green: {
    badge: "Ready",
    tone: "success",
    headline: "Ready to use",
    body: "This shot generated cleanly and is ready to download.",
  },
  amber: {
    badge: "Review recommended",
    tone: "caution",
    headline: "Review recommended",
    body: "Take a moment to check the details below before you publish. Regenerating costs one generation.",
  },
  red: {
    badge: "Enhanced",
    tone: "danger",
    headline: "Enhanced and placed",
    body: "Oviya enhances and places your piece. For facet-level hero detail, we recommend a macro shot. Please review carefully.",
  },
};

// The one-tap QC checklist surfaced for AMBER outputs.
export const QC_CHECKLIST = [
  { id: "hands", label: "Hands and fingers look natural" },
  { id: "fit", label: "Garment fit and drape look right" },
  { id: "pattern", label: "Prints and patterns align correctly" },
  { id: "continuity", label: "Colour and detail match the original product" },
];
