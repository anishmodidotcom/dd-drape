import { TIER_PRESENTATION } from "@/lib/shot/qc";
import type { Tier } from "@/lib/engine/tier";

export function TierBadge({ tier }: { tier: Tier }) {
  const p = TIER_PRESENTATION[tier];
  const cls = tier === "green" ? "chip-green" : tier === "amber" ? "chip-amber" : "chip-red";
  return <span className={`chip ${cls}`}>{p.badge}</span>;
}
