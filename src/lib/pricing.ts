// Oviya pricing + credits structure (Phase 4B). SINGLE SOURCE of truth for tiers and the value
// math. Prices are PROVISIONAL launch pricing; the final numbers drop in here in the later commerce
// audit (change `price` / `currency` / `credits` only). The structure is built so a real payment
// provider (Razorpay / Stripe) wires into `Tier.id` later without touching the UI.

export const LAUNCH_PRICING = true; // shown as a clear "launch pricing" marker in the UI
export const CURRENCY = { symbol: "$", code: "USD" }; // swap to INR (₹/"INR") in the commerce audit

// Representative engine credit costs (1 credit = 1 cent), mirroring src/lib/engine/registry.ts so the
// "what you get" math stays honest. Used only to translate credits -> approx outputs for the UI.
export const CREDIT_COSTS = {
  stillStandard: 4, // Draft still
  stillHero: 15, // Hero still (premium fidelity)
  video: 56, // a ~5s reel (11.2 credits/sec)
  model: 49, // create a reusable model
};

export const FREE_GRANT = 400; // credits granted on signup (matches the existing grant)

export interface Tier {
  id: "atelier" | "studio" | "maison";
  name: string;
  tagline: string;
  price: number; // provisional, in CURRENCY
  credits: number;
  popular?: boolean;
  perks: string[];
}

export const TIERS: Tier[] = [
  {
    id: "atelier",
    name: "Atelier",
    tagline: "For a first collection.",
    price: 19,
    credits: 2000,
    perks: ["Every editorial style and control", "Reusable models", "Commercial usage rights", "Email support"],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For a working label.",
    price: 49,
    credits: 6000,
    popular: true,
    perks: ["Everything in Atelier", "Priority rendering", "Multi-product shoots", "Video and Replace"],
  },
  {
    id: "maison",
    name: "Maison",
    tagline: "For a full catalogue.",
    price: 119,
    credits: 16000,
    perks: ["Everything in Studio", "Highest volume", "Early access to new looks", "Concierge onboarding"],
  },
];

// Translate a credit balance into the legible "about N shots and M videos" promise.
export function approxOutputs(credits: number): { heroStills: number; draftStills: number; videos: number } {
  return {
    heroStills: Math.round(credits / CREDIT_COSTS.stillHero),
    draftStills: Math.round(credits / CREDIT_COSTS.stillStandard),
    videos: Math.round(credits / CREDIT_COSTS.video),
  };
}

export const SUPPORT_EMAIL = "anish.modi@deeperdesigns.in";
