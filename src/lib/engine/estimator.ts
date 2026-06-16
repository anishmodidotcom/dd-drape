// Cost estimator. Computes provider cost BEFORE spending (dry-run), in CREDITS.
// 1 credit = $0.01 = 1 US cent. Credits are always whole numbers; we round UP so we
// never under-reserve and accidentally ship a free generation.

import { lookup, type Need, type CostUnit } from "./registry";

export interface EstimateInput {
  need: Need;
  /** Number of output images/clips. Defaults to 1. */
  count?: number;
  /** Clip length in seconds, for video needs. */
  seconds?: number;
  /** Output size in megapixels, for per-MP models. */
  megapixels?: number;
  /** Approx token count, for token-billed models. */
  tokens?: number;
  /** Optional live-fetched per-unit cost in cents, overriding the registry default. */
  liveUnitCostCents?: number;
}

export interface Estimate {
  need: Need;
  slug: string;
  unit: CostUnit;
  unitCostCents: number;
  units: number;
  /** Whole credits to reserve. */
  credits: number;
}

function unitsFor(input: EstimateInput, unit: CostUnit): number {
  const count = input.count ?? 1;
  switch (unit) {
    case "image":
      return count;
    case "second":
      if (!input.seconds || input.seconds <= 0) {
        throw new Error(`Estimate for "${input.need}" requires seconds > 0`);
      }
      return input.seconds * count;
    case "megapixel":
      if (!input.megapixels || input.megapixels <= 0) {
        throw new Error(`Estimate for "${input.need}" requires megapixels > 0`);
      }
      return input.megapixels * count;
    case "token":
      if (!input.tokens || input.tokens <= 0) {
        throw new Error(`Estimate for "${input.need}" requires tokens > 0`);
      }
      return input.tokens * count;
    default:
      throw new Error(`Unknown cost unit "${unit}"`);
  }
}

export function estimate(input: EstimateInput): Estimate {
  const entry = lookup(input.need);
  const unitCostCents = input.liveUnitCostCents ?? entry.unitCostCents;
  const units = unitsFor(input, entry.unit);
  // Round UP to whole credits so reservation always covers (or exceeds) real cost.
  const credits = Math.ceil(units * unitCostCents);

  return {
    need: input.need,
    slug: entry.slug,
    unit: entry.unit,
    unitCostCents,
    units,
    credits,
  };
}
