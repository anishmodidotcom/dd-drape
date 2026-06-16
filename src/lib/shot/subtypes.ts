// Category -> sub-type catalogue (Section 7.2). The sub-type sets the default register and feeds
// the tier classification. Used by the wizard's "What is it?" step.

import type { Category } from "./spec";

export interface SubTypeOption {
  id: string;
  label: string;
}

export const SUBTYPES: Record<Category, SubTypeOption[]> = {
  apparel: [
    { id: "saree", label: "Saree" },
    { id: "lehenga", label: "Lehenga" },
    { id: "kurta", label: "Kurta / Kurti" },
    { id: "salwar", label: "Salwar suit" },
    { id: "anarkali", label: "Anarkali" },
    { id: "blouse", label: "Blouse" },
    { id: "dress", label: "Dress" },
    { id: "top", label: "Top" },
    { id: "shirt", label: "Shirt" },
    { id: "t-shirt", label: "T-shirt" },
    { id: "denim", label: "Denim / Jeans" },
    { id: "trousers", label: "Trousers" },
    { id: "co-ord", label: "Co-ord set" },
    { id: "activewear", label: "Activewear" },
    { id: "kidswear", label: "Kidswear" },
    { id: "lingerie", label: "Lingerie / Swimwear" },
    { id: "abaya", label: "Abaya / Modest" },
    { id: "sherwani", label: "Sherwani / Bandhgala" },
  ],
  jewellery: [
    { id: "necklace", label: "Necklace" },
    { id: "earrings", label: "Earrings" },
    { id: "ring", label: "Ring" },
    { id: "bangle", label: "Bangle / Bracelet" },
    { id: "maang-tikka", label: "Maang tikka / Passa" },
    { id: "nath", label: "Nath" },
    { id: "bridal-set", label: "Bridal set" },
    { id: "anklet", label: "Anklet" },
    { id: "brooch", label: "Brooch" },
  ],
  accessory: [
    { id: "handbag", label: "Handbag" },
    { id: "clutch", label: "Clutch" },
    { id: "footwear", label: "Footwear" },
    { id: "eyewear", label: "Eyewear" },
    { id: "watch", label: "Watch" },
    { id: "belt", label: "Belt" },
    { id: "scarf", label: "Scarf / Stole" },
  ],
};

export const CATEGORY_LABELS: Record<Category, string> = {
  apparel: "Apparel",
  jewellery: "Jewellery",
  accessory: "Accessory",
};
