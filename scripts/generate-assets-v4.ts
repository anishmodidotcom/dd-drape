/* Oviya v4 brand/site/UI asset generation. MIXED MODELS for a real per-use-case comparison:
 * Gemini Nano Banana Pro for the editorial money shots; fal-hosted Flux/Seedream for textures,
 * backgrounds, and some preset thumbnails. Every asset is tagged with the model that made it and
 * logged with prompt + estimated cost to docs/ASSET_PROMPTS_V4.md. Saved to public/v4/** so the
 * existing v3 assets (landing/studio) are untouched; the /design page reads public/v4/manifest.json.
 *
 *   GEMINI_API_KEY=... FAL_KEY=... npx tsx scripts/generate-assets-v4.ts
 *   FORCE=1 to regenerate everything. ONLY=gemini|fal to run a subset.
 *
 * Gemini/fal here generate BRAND/SITE/UI imagery only. The product engine is never touched.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { fal } from "@fal-ai/client";

if (!process.env.GEMINI_API_KEY && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
  }
}
const KEY = process.env.GEMINI_API_KEY;
const FAL = process.env.FAL_KEY;
if (!KEY) throw new Error("GEMINI_API_KEY not set");
if (FAL) fal.config({ credentials: FAL });
const FORCE = process.env.FORCE === "1";
const ONLY = process.env.ONLY; // "gemini" | "fal"

const PRO = "gemini-3-pro-image";
const FLASH = "gemini-2.5-flash-image";
const FAL_FLUX = "fal-ai/flux/dev";

// Estimated per-image cost (USD) for the spend report. Approximate published rates.
const COST: Record<string, number> = {
  "gemini-pro": 0.134,
  "gemini-flash": 0.039,
  "fal-flux": 0.025,
};

const REALISM =
  "photorealistic high-end fashion photography, natural skin texture with visible pores, lifelike hands, sharp fabric detail, professional studio retouching, no plastic skin, no AI artifacts, editorial magazine quality";
const NO_TEXT =
  "ABSOLUTELY NO text, no typography, no words, no letters, no captions, no titles, no logos, no watermark anywhere. A single clean full-bleed photograph only. NOT a photo of a printed magazine page or book spread, no paper edges, no page borders, image fills the entire frame.";
// One cohesive grade across the whole set, so range never reads as mess.
const GRADE =
  "cohesive Oviya color grade: rich controlled contrast, gently desaturated with a warm shadow and a clean highlight roll-off, a faint oxblood-and-cream undertone in the grade, film-like, gallery-print quality";

type Model = "gemini-pro" | "gemini-flash" | "fal-flux";
interface Asset {
  id: string;
  file: string;
  model: Model;
  prompt: string;
  aspect?: string;
  inputFrom?: string;
  style: string; // luxury-style tag
}

const g = (id: string, sub: string, style: string, aspect: string, prompt: string, model: Model = "gemini-pro"): Asset => ({
  id,
  file: `public/v4/${sub}/${id}.png`,
  model,
  aspect,
  style,
  prompt: `${prompt} ${GRADE}. ${REALISM}`,
});

// ---- HEROES (3, Gemini Pro) ----
const HERO: Asset[] = [
  g("hero-dark", "hero", "chiaroscuro studio portrait", "4:5",
    "Cinematic full-length fashion editorial for a luxury art house. A dark-skinned Black female model in a sculptural oxblood silk gown, standing in deep chiaroscuro against a near-black warm-onyx void, a single hard rim light carving her silhouette, 85mm lens, shallow depth of field, couture restraint, Bottega-quiet styling"),
  g("hero-light", "hero", "sun-drenched mediterranean editorial", "4:5",
    "Sun-drenched Mediterranean fashion editorial on a warm cream plaster wall, a South Asian female model with medium-deep skin in a tailored ivory linen suit, hard midday sun and crisp shadow, Jacquemus wit, airy and luminous, 50mm lens, generous negative space"),
  g("hero-wide", "hero", "warm-grey studio campaign", "16:9",
    "Wide luxury campaign banner on a seamless warm-greige studio backdrop, a pair of models, one East Asian woman in a deep forest column dress and one white European man in a charcoal grotesk-tailored suit, soft north-window light, restrained and editorial, lots of air"),
];

// ---- GALLERY (14, Gemini Pro) spanning style + diversity, international + Indian 50/50 ----
const GALLERY: Asset[] = [
  g("g-saree", "gallery", "heritage interior chiaroscuro", "3:4", "A South Indian woman in a deep teal Kanjivaram silk saree with antique-gold zari, seated regal in a carved heritage interior, warm low tungsten light, painterly"),
  g("g-lehenga", "gallery", "bridal couture studio", "3:4", "A North Indian bride in an oxblood and antique-gold embroidered lehenga, dramatic Rembrandt studio light on a deep warm-grey backdrop, couture"),
  g("g-sherwani", "gallery", "menswear heritage", "3:4", "A South Asian man with a deep skin tone in an ivory raw-silk bandhgala sherwani, warm window light, dignified three-quarter portrait, quiet luxury"),
  g("g-jewellery", "gallery", "jewellery macro on-body", "1:1", "Macro on-body jewellery editorial, the neck and collarbone of an East Asian woman wearing a fine antique-gold and emerald necklace, diffused tent light with a single controlled sparkle, near-black background"),
  g("g-street", "gallery", "indo-western streetwear", "3:4", "A North-East Indian Gen-Z model in a layered indo-western co-ord, overcast natural light on a concrete urban rooftop, candid confident, brutalist mood"),
  g("g-accessory", "gallery", "accessory still campaign", "1:1", "A structured oxblood leather handbag held by a model with light-brown skin, warm cream studio light, minimal luxury product styling"),
  g("g-medit", "gallery", "sun-drenched campaign", "3:4", "A white European female model in a flowing sand-colored summer dress, golden-hour backlight in a Mediterranean olive grove, warm and cinematic"),
  g("g-quiet", "gallery", "quiet-luxury muted crop", "3:4", "A Black female model with short cropped hair in a camel cashmere coat, muted warm-grey studio, soft directional light, restrained quiet-luxury crop, Bottega register"),
  g("g-brutalist", "gallery", "brutalist concrete art-set", "3:4", "A South Asian woman in an architectural deep-green draped gown against a raw brutalist concrete art-set, hard sculptural daylight, gallery sensibility"),
  g("g-painterly", "gallery", "painterly cinematic interior", "3:4", "A Latina model in a midnight-indigo silk slip dress in a dim painterly interior, single warm practical light, chiaroscuro, old-master cinematic"),
  g("g-mature", "gallery", "elegant studio portrait", "3:4", "An elegant South Asian woman in her late 40s in a charcoal tailored suit with a single antique-gold brooch, warm-grey studio, soft beauty light, confident"),
  g("g-macro", "gallery", "tactile craft macro", "1:1", "Tactile macro of hand embroidery, antique-gold zari thread on oxblood silk, raking warm light revealing texture, no model, gallery-print"),
  g("g-eastasian", "gallery", "high-key minimal studio", "3:4", "An East Asian male model in a soft oatmeal knit and wide cream trousers, high-key minimal studio, clean even light, Scandinavian editorial calm"),
  g("g-anarkali", "gallery", "festive warm interior", "3:4", "A South Asian woman with medium skin in a sandstone and gold anarkali, warm diya candlelight in a heritage haveli courtyard, festive but refined"),
];

// ---- BEFORE / AFTER (3 pairs = 6, Gemini Pro; after fed from before for true correspondence) ----
const BA: Asset[] = [
  g("ba1-before", "before-after", "flat-lay product", "3:4", "Flat-lay product photograph of a plain sandstone-beige chikankari cotton kurta on a pure white seamless background, ecommerce catalog style, no model, soft even light"),
  { ...g("ba1-after", "before-after", "on-model heritage", "3:4", "Place this exact sandstone chikankari kurta from the reference image on a South Asian female model, full-length editorial, soft window light in a heritage interior. Preserve the exact colour, chikankari embroidery and fabric"), inputFrom: "ba1-before" },
  g("ba2-before", "before-after", "flat-lay product", "3:4", "Flat-lay of a deep oxblood silk wrap dress on a pure white background, ecommerce style, no model"),
  { ...g("ba2-after", "before-after", "on-model studio", "3:4", "Place this exact oxblood silk wrap dress from the reference image on a Black female model, full-length studio editorial with soft chiaroscuro on a warm-grey backdrop. Preserve the exact colour, drape and fabric"), inputFrom: "ba2-before" },
  g("ba3-before", "before-after", "flat-lay product", "3:4", "Flat-lay of a forest-green tailored linen blazer on a white background, ecommerce style, no model"),
  { ...g("ba3-after", "before-after", "on-model campaign", "3:4", "Place this exact forest-green linen blazer from the reference image on a white European male model, clean sun-drenched Mediterranean campaign on a cream plaster wall. Preserve the exact colour and tailoring"), inputFrom: "ba3-before" },
];

// ---- LOOKS / EDITORIALS (10, MIX gemini + fal for comparison), named tastefully ----
const LOOKS: Asset[] = [
  g("look-red-carpet", "looks", "red-carpet gala", "3:4", "Red-carpet gala glamour, a model in a sweeping oxblood embellished gown against a deep warm-onyx backdrop, single dramatic key light"),
  g("look-quiet-luxury", "looks", "quiet luxury", "3:4", "Quiet-luxury muted editorial, a model in camel and cream tailoring, soft north-window light, restrained"),
  g("look-sun-drenched", "looks", "sun-drenched campaign", "3:4", "Sun-drenched outdoor campaign, a model in flowing summer couture, hard golden-hour backlight, warm"),
  g("look-noir", "looks", "art-house noir", "3:4", "Raw high-contrast black and white art-house editorial, a model in draped fabric, dramatic shadow, grainy film"),
  g("look-heritage", "looks", "indian heritage", "3:4", "Warm Indian heritage editorial, a model in festive ethnic wear, diya candlelight in a carved-wood interior, golden tones"),
  g("look-brutalist", "looks", "brutalist art-set", "3:4", "Brutalist concrete art-set editorial, a model in architectural draping, hard sculptural daylight", "fal-flux"),
  g("look-atelier", "looks", "tactile craft macro", "3:4", "Tactile atelier macro of luxury fabric and embroidery detail, raking warm light, no model", "fal-flux"),
  g("look-catalog", "looks", "clean catalog", "3:4", "Clean Scandinavian ecommerce catalog look, a model on a pure warm-white seamless, soft even two-zone light, minimal", "fal-flux"),
  g("look-painterly", "looks", "painterly cinematic", "3:4", "Painterly cinematic editorial, a model in jewel-tone silk in a dim old-master interior, single warm practical light", "fal-flux"),
  g("look-street", "looks", "urban street", "3:4", "Urban streetwear editorial, a model in layered city fashion, overcast natural light, concrete backdrop", "fal-flux"),
];

// ---- EMPTY / ONBOARDING (3, mix) ----
const EMPTY: Asset[] = [
  g("empty-studio", "empty", "empty atelier set", "1:1", "An elegant empty fashion photography atelier, a single stool under a softbox, warm-onyx moody atmosphere, no people, cinematic, waiting for a shoot"),
  g("empty-casting", "empty", "casting board", "1:1", "A minimal editorial casting board concept, an empty polaroid frame on a warm-grey textured surface, soft light, no people, premium", "fal-flux"),
  g("sample-product", "empty", "flat-lay sample", "3:4", "Flat-lay product photograph of a plain forest-green cotton kurta on a pure white background, ecommerce catalog style, no model, soft light", "fal-flux"),
];

// ---- TEXTURES / BACKGROUNDS (5, fal Flux) ----
const TEX: Asset[] = [
  g("tex-plaster", "texture", "warm plaster wall", "16:9", "Seamless warm cream plaster wall texture, soft raking daylight, subtle imperfections, no objects, full-bleed surface plate", "fal-flux"),
  g("tex-concrete", "texture", "brutalist concrete", "16:9", "Seamless raw brutalist concrete wall texture, neutral warm-grey, soft shadow, no objects, surface plate", "fal-flux"),
  g("tex-linen", "texture", "oatmeal linen", "1:1", "Seamless close-up of oatmeal linen fabric weave, soft directional light, tactile, no objects", "fal-flux"),
  g("tex-paper", "texture", "deckle paper", "1:1", "Seamless warm off-white deckle-edge art paper texture, soft light, gallery sensibility, no objects", "fal-flux"),
  g("tex-onyx", "texture", "warm onyx void", "16:9", "Seamless deep warm-onyx near-black gradient backdrop plate with a faint oxblood luminous bloom, no objects, cinematic studio void", "fal-flux"),
];

// When the Gemini key is unavailable (e.g. credits depleted), GEMINI_TO_FAL completes the set on
// fal Flux instead, tagged honestly. Before/after pairs are dropped in that mode (fal text-to-image
// cannot take the flat-lay as input for true correspondence; the verified v3 Gemini pairs stand).
const TO_FAL = process.env.GEMINI_TO_FAL === "1";
let pool = [...HERO, ...GALLERY, ...BA, ...LOOKS, ...EMPTY, ...TEX];
if (TO_FAL) {
  pool = pool.filter((a) => !a.inputFrom && !BA.includes(a));
  for (const a of pool) if (a.model.startsWith("gemini")) a.model = "fal-flux";
}
const ALL: Asset[] = pool.filter((a) =>
  !ONLY ? true : ONLY === "fal" ? a.model === "fal-flux" : a.model.startsWith("gemini")
);
const byId = new Map([...HERO, ...GALLERY, ...BA, ...LOOKS, ...EMPTY, ...TEX].map((a) => [a.id, a]));

function aspectToFal(aspect?: string): string {
  switch (aspect) {
    case "16:9": return "landscape_16_9";
    case "1:1": return "square_hd";
    case "4:5":
    case "3:4": return "portrait_4_3";
    default: return "portrait_4_3";
  }
}

async function genGemini(a: Asset): Promise<Buffer> {
  const parts: unknown[] = [];
  if (a.inputFrom) {
    const src = byId.get(a.inputFrom)!;
    parts.push({ inlineData: { mimeType: "image/png", data: readFileSync(src.file).toString("base64") } });
  }
  parts.push({ text: `${a.prompt} ${NO_TEXT}` });
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"], ...(a.aspect ? { imageConfig: { aspectRatio: a.aspect } } : {}) },
  };
  for (const model of [a.model === "gemini-flash" ? FLASH : PRO, FLASH]) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    const img = j?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData);
    if (img) return Buffer.from(img.inlineData.data, "base64");
    console.warn(`  ${a.id} via ${model}: ${j?.error?.message?.slice(0, 110) ?? "no image"}`);
  }
  throw new Error(`gemini failed for ${a.id}`);
}

async function genFalImage(a: Asset): Promise<Buffer> {
  if (!FAL) throw new Error("FAL_KEY not set");
  const res = await fal.subscribe(FAL_FLUX, {
    input: { prompt: `${a.prompt} ${NO_TEXT}`, image_size: aspectToFal(a.aspect) as "portrait_4_3", num_images: 1, num_inference_steps: 30, guidance_scale: 3.5, enable_safety_checker: false },
  });
  const url = (res as { data?: { images?: { url: string }[] } }).data?.images?.[0]?.url;
  if (!url) throw new Error(`fal returned no image for ${a.id}`);
  const dl = await fetch(url);
  return Buffer.from(await dl.arrayBuffer());
}

async function main() {
  const manifest: Record<string, { path: string; model: Model; style: string }> = {};
  const rows: string[] = [];
  let spend = 0;
  for (const a of ALL) {
    manifest[a.id] = { path: "/" + a.file.replace(/^public\//, ""), model: a.model, style: a.style };
    rows.push(`| ${a.id} | ${a.model} | ${a.aspect ?? "-"} | ${a.style} | $${COST[a.model].toFixed(3)} | ${a.prompt.replace(/\|/g, "/").slice(0, 180)}... |`);
    if (!FORCE && existsSync(a.file)) {
      console.log(`skip (exists): ${a.id}`);
      spend += 0;
      continue;
    }
    mkdirSync(dirname(a.file), { recursive: true });
    process.stdout.write(`generating ${a.id} [${a.model}] ... `);
    try {
      const buf = a.model === "fal-flux" ? await genFalImage(a) : await genGemini(a);
      writeFileSync(a.file, buf);
      spend += COST[a.model];
      console.log(`ok (${(buf.length / 1024).toFixed(0)}kb)`);
    } catch (e) {
      console.warn(`FAILED ${a.id}: ${(e as Error).message}`);
    }
  }
  mkdirSync("public/v4", { recursive: true });
  writeFileSync("public/v4/manifest.json", JSON.stringify(manifest, null, 2));

  const doc = [
    "# Oviya v4 - generated asset prompts + model comparison\n",
    "Mixed-model brand/site/UI imagery. Gemini Nano Banana Pro for editorial money shots; fal Flux for textures, backgrounds, and some preset thumbnails. The product engine is never routed here.\n",
    `Estimated spend this run: ~$${spend.toFixed(2)} (${ALL.length} assets). Per-image estimates: gemini-pro $${COST["gemini-pro"]}, gemini-flash $${COST["gemini-flash"]}, fal-flux $${COST["fal-flux"]}.\n`,
    "| id | model | aspect | style | est. cost | prompt |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
  writeFileSync("docs/ASSET_PROMPTS_V4.md", doc);
  console.log(`\nDone. ${ALL.length} assets. Est spend ~$${spend.toFixed(2)}. Manifest: public/v4/manifest.json`);
}
main().catch((e) => {
  console.error("v4 asset generation failed:", e);
  process.exit(1);
});
