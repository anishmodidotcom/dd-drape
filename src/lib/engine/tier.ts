// AI-readiness router. Every generation is classified into a tier that controls delivery.
//   GREEN: auto-generate, deliver instantly.
//   AMBER: generate, then route to an in-app QC step (review recommended).
//   RED:   generate in enhancement mode only, honest framing, human QC surfaced.
//
// Maps (category, sub-type complexity, shot type) -> tier per the Section 6 matrix.

export type Tier = "green" | "amber" | "red";

export type Category = "apparel" | "jewellery" | "accessory";

export type ShotType =
  | "background-swap"
  | "flat-lay" // includes ghost-mannequin cleanup
  | "colour-variant"
  | "on-model-full"
  | "detail-macro"
  | "lifestyle";

// Apparel sub-types split into "simple" (solid / simple-pattern structured garments) and
// "complex" (drape / print / logo: sarees, lehengas, sheers, heavy embroidery, graphic prints).
const COMPLEX_APPAREL = new Set<string>([
  "saree",
  "lehenga",
  "dupatta",
  "anarkali",
  "sherwani",
  "bandhgala",
  "lingerie",
  "swimwear",
  "abaya",
  "modest",
]);

export interface ClassifyInput {
  category: Category;
  /** Garment / item sub-type, e.g. "saree", "t-shirt", "necklace", "handbag". */
  subType: string;
  shotType: ShotType;
}

// Column resolver: which matrix column this item falls into.
type Column = "apparel-simple" | "apparel-complex" | "accessories" | "jewellery";

function resolveColumn(category: Category, subType: string): Column {
  if (category === "jewellery") return "jewellery";
  if (category === "accessory") return "accessories";
  // apparel
  return COMPLEX_APPAREL.has(subType.toLowerCase().trim())
    ? "apparel-complex"
    : "apparel-simple";
}

// Section 6 matrix, encoded directly.
const MATRIX: Record<ShotType, Record<Column, Tier>> = {
  "background-swap": {
    "apparel-simple": "green",
    "apparel-complex": "green",
    accessories: "green",
    jewellery: "amber",
  },
  "flat-lay": {
    "apparel-simple": "green",
    "apparel-complex": "amber",
    accessories: "green",
    jewellery: "amber",
  },
  "colour-variant": {
    "apparel-simple": "green",
    "apparel-complex": "amber",
    accessories: "green",
    jewellery: "amber",
  },
  "on-model-full": {
    "apparel-simple": "amber",
    "apparel-complex": "red",
    accessories: "amber",
    jewellery: "red",
  },
  "detail-macro": {
    "apparel-simple": "amber",
    "apparel-complex": "red",
    accessories: "amber",
    jewellery: "red",
  },
  lifestyle: {
    "apparel-simple": "amber",
    "apparel-complex": "red",
    accessories: "amber",
    jewellery: "red",
  },
};

export function classifyTier(input: ClassifyInput): Tier {
  const column = resolveColumn(input.category, input.subType);
  const row = MATRIX[input.shotType];
  if (!row) {
    throw new Error(`Unknown shot type "${input.shotType}"`);
  }
  return row[column];
}
