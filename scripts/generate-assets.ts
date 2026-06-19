/* Oviya Studio brand/site/preset asset generation. Gemini (Nano Banana Pro) ONLY for
 * brand/marketing/preset imagery - NEVER the product engine (that stays on fal). Idempotent +
 * re-runnable: skips assets already on disk unless FORCE=1. Documents every prompt to
 * docs/ASSET_PROMPTS.md and writes a manifest the UI reads.
 *
 *   GEMINI_API_KEY=... npx tsx scripts/generate-assets.ts
 *   FORCE=1 ... to regenerate everything.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

// Load .env.local if GEMINI_API_KEY isn't already in the env.
if (!process.env.GEMINI_API_KEY && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
  }
}
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error("GEMINI_API_KEY not set");
const FORCE = process.env.FORCE === "1";

const PRO = "gemini-3-pro-image";
const FLASH = "gemini-2.5-flash-image";
const REALISM =
  "photorealistic high-end fashion photography, natural skin texture with visible pores, lifelike hands, sharp fabric detail, professional studio retouching, no plastic skin, no AI artifacts, editorial magazine quality";
// Appended to every prompt: kill the baked-in magazine typography and printed-page framing Gemini
// tends to add. We overlay our own copy, so assets must be clean full-bleed photographs.
const NO_TEXT =
  "ABSOLUTELY NO text, no typography, no words, no letters, no captions, no titles, no logos, no watermark, no signature anywhere in the image. A single clean full-bleed photograph only. NOT a photo of a printed magazine page or book spread, no paper edges, no page borders, no margins, image fills the entire frame.";

interface Asset {
  id: string;
  file: string;
  prompt: string;
  model?: string;
  aspect?: string;
  inputFrom?: string; // another asset id whose image is fed in (for corresponding before/after)
}

// Art-directed brief. Modern Indian + Western editorial fusion, Met-Gala energy, temple-gold mood.
const HERO: Asset[] = [
  { id: "hero-1", file: "public/brand/hero-1.png", aspect: "4:5",
    prompt: `Cinematic editorial fashion photograph for a luxury fashion house homepage. A South Asian woman in a sculptural deep-emerald silk gown with gold zari detailing, standing against a near-black layered backdrop with a single warm champagne-gold rim light. Met Gala red-carpet energy, dramatic chiaroscuro, 85mm lens, shallow depth of field, couture styling, ${REALISM}` },
  { id: "hero-2", file: "public/brand/hero-2.png", aspect: "16:9",
    prompt: `Wide cinematic fashion editorial banner. A diverse pair of models, one in a contemporary western tailored ivory suit and one in a modern Indian gold-embroidered lehenga, on a dark moody studio set with soft volumetric haze and warm gold accent light. High-fashion campaign, restrained luxury, ${REALISM}` },
];

const GALLERY: Asset[] = [
  { id: "g-saree", file: "public/gallery/saree.png", aspect: "3:4",
    prompt: `Editorial fashion photo of a South Indian model in a rich Kanjivaram silk saree, temple jewellery, heritage interior with warm diya candlelight, regal pose, ${REALISM}` },
  { id: "g-lehenga", file: "public/gallery/lehenga.png", aspect: "3:4",
    prompt: `Editorial bridal fashion photo, a model in a crimson and gold embroidered lehenga, dramatic studio Rembrandt lighting on a dark backdrop, couture mood, ${REALISM}` },
  { id: "g-western", file: "public/gallery/western.png", aspect: "3:4",
    prompt: `High-gloss western editorial, a model in a sharp black tailored blazer and minimal gold jewellery, clean grey seamless studio, Vogue cover energy, ${REALISM}` },
  { id: "g-jewellery", file: "public/gallery/jewellery.png", aspect: "1:1",
    prompt: `Luxury jewellery editorial close-up, a model's neck and decolletage wearing an intricate gold and emerald necklace, diffused light tent with a sparkle highlight, dark background, ${REALISM}` },
  { id: "g-street", file: "public/gallery/street.png", aspect: "3:4",
    prompt: `Streetwear fusion editorial, a Gen-Z model in an indo-western co-ord set, golden-hour natural light on an urban rooftop, candid confident pose, ${REALISM}` },
  { id: "g-accessory", file: "public/gallery/accessory.png", aspect: "1:1",
    prompt: `Premium accessory campaign, a model holding a structured leather handbag, warm champagne studio light, minimal luxury styling, ${REALISM}` },
];

// Before/after PAIRS: generate the flat-lay (before) first, then feed it as input to place the
// SAME garment on a model (after), so the pair genuinely corresponds.
const BEFORE_AFTER: Asset[] = [
  { id: "ba1-before", file: "public/before-after/1-before.png", aspect: "3:4",
    prompt: `Flat-lay product photograph of a plain teal chikankari cotton kurta neatly laid on a pure white seamless background, ecommerce catalog style, no model, soft even light, ${REALISM}` },
  { id: "ba1-after", file: "public/before-after/1-after.png", aspect: "3:4", inputFrom: "ba1-before",
    prompt: `Place this exact teal chikankari kurta from the reference image on a South Asian female model, full-length editorial fashion photo, soft window light, heritage interior. Preserve the exact teal colour, chikankari embroidery and fabric. ${REALISM}` },
  { id: "ba2-before", file: "public/before-after/2-before.png", aspect: "3:4",
    prompt: `Flat-lay product photograph of a deep maroon and gold silk lehenga skirt laid on a white background, ecommerce style, no model, ${REALISM}` },
  { id: "ba2-after", file: "public/before-after/2-after.png", aspect: "3:4", inputFrom: "ba2-before",
    prompt: `Place this exact maroon and gold lehenga from the reference image on a model, full-length bridal editorial, dramatic studio lighting on a dark backdrop. Preserve the exact colour, gold work and fabric. ${REALISM}` },
  { id: "ba3-before", file: "public/before-after/3-before.png", aspect: "3:4",
    prompt: `Flat-lay of a plain white western cotton shirt on a white background, ecommerce style, no model, ${REALISM}` },
  { id: "ba3-after", file: "public/before-after/3-after.png", aspect: "3:4", inputFrom: "ba3-before",
    prompt: `Place this exact white shirt from the reference image on a model, clean editorial ecommerce shot on light grey seamless, natural pose. Preserve the exact shirt. ${REALISM}` },
];

// "Looks" / Editorials preset thumbnails - distinct editorial styles, original names.
const LOOKS: Asset[] = [
  { id: "look-gloss", file: "public/looks/high-gloss.png", aspect: "3:4", prompt: `Glossy high-fashion magazine cover style, a model in a bold satin dress, high-key punchy studio light, saturated, Vogue gloss, ${REALISM}` },
  { id: "look-noir", file: "public/looks/noir.png", aspect: "3:4", prompt: `Raw high-contrast black and white art-house fashion editorial, dramatic shadows, a model in draped fabric, grainy film aesthetic, ${REALISM}` },
  { id: "look-heritage", file: "public/looks/heritage.png", aspect: "3:4", prompt: `Warm festive Indian heritage editorial, a model in ethnic wear, diya candlelight in a carved-wood heritage interior, golden tones, ${REALISM}` },
  { id: "look-catalog", file: "public/looks/catalog.png", aspect: "3:4", prompt: `Clean Scandinavian ecommerce catalog look, a model on a pure white seamless background, soft even two-zone light, minimal, marketplace-ready, ${REALISM}` },
  { id: "look-campaign", file: "public/looks/campaign.png", aspect: "3:4", prompt: `Sun-drenched outdoor campaign, a model in flowing summer couture, natural golden-hour backlight in a desert landscape, ${REALISM}` },
  { id: "look-couture", file: "public/looks/couture.png", aspect: "3:4", prompt: `Moody luxury fashion-house couture editorial, a model in avant-garde structured fashion, deep shadow, single warm accent light, ${REALISM}` },
  { id: "look-street", file: "public/looks/street.png", aspect: "3:4", prompt: `Streetwear Gen-Z editorial, a model in layered urban indo-western fashion, overcast natural light, city backdrop, ${REALISM}` },
  { id: "look-gala", file: "public/looks/gala.png", aspect: "3:4", prompt: `Red-carpet gala glamour, a model in a sweeping embellished gown, paparazzi flash energy against a dark backdrop, ${REALISM}` },
];

const EMPTY: Asset[] = [
  { id: "empty-studio", file: "public/empty/studio.png", aspect: "1:1", prompt: `An elegant empty fashion photography studio set, a single stool under a softbox, dark moody atmosphere with a warm gold light, no people, cinematic, evocative, waiting for a shoot, ${REALISM}` },
  { id: "empty-casting", file: "public/empty/casting.png", aspect: "1:1", prompt: `A minimal editorial casting board concept, an empty polaroid frame on a dark textured surface with warm gold light, no people, premium fashion mood, ${REALISM}` },
  { id: "sample-product", file: "public/brand/sample-product.png", aspect: "3:4", prompt: `Flat-lay product photograph of a plain sage-green cotton kurta on a pure white background, ecommerce catalog style, no model, soft light, ${REALISM}` },
];

const ALL: Asset[] = [...HERO, ...GALLERY, ...BEFORE_AFTER, ...LOOKS, ...EMPTY];
const byId = new Map(ALL.map((a) => [a.id, a]));

async function genImage(a: Asset): Promise<Buffer> {
  const parts: unknown[] = [];
  if (a.inputFrom) {
    const src = byId.get(a.inputFrom)!;
    const b64 = readFileSync(src.file).toString("base64");
    parts.push({ inlineData: { mimeType: "image/png", data: b64 } });
  }
  parts.push({ text: `${a.prompt} ${NO_TEXT}` });
  const body = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ["IMAGE"], ...(a.aspect ? { imageConfig: { aspectRatio: a.aspect } } : {}) },
  };
  for (const model of [a.model ?? PRO, FLASH]) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    const img = j?.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData);
    if (img) return Buffer.from(img.inlineData.data, "base64");
    console.warn(`  ${a.id} via ${model} failed: ${j?.error?.message?.slice(0, 120) ?? "no image"}`);
  }
  throw new Error(`could not generate ${a.id}`);
}

async function main() {
  const manifest: Record<string, string> = {};
  const prompts: string[] = ["# Oviya Studio - generated asset prompts\n", "All brand/site/preset imagery is generated with Gemini Nano Banana Pro. The product engine stays on fal.\n"];
  // Sequential within groups (before/after has dependencies); modest pace to respect rate limits.
  for (const a of ALL) {
    prompts.push(`## ${a.id}  (${a.aspect ?? "default"})\n\`${a.file}\`\n\n${a.prompt}\n`);
    manifest[a.id] = "/" + a.file.replace(/^public\//, "");
    if (!FORCE && existsSync(a.file)) {
      console.log(`skip (exists): ${a.id}`);
      continue;
    }
    mkdirSync(dirname(a.file), { recursive: true });
    process.stdout.write(`generating ${a.id} ... `);
    const buf = await genImage(a);
    writeFileSync(a.file, buf);
    console.log(`ok (${(buf.length / 1024).toFixed(0)}kb)`);
  }
  mkdirSync("public/brand", { recursive: true });
  writeFileSync("public/brand/manifest.json", JSON.stringify(manifest, null, 2));
  writeFileSync("docs/ASSET_PROMPTS.md", prompts.join("\n"));
  console.log(`\nDone. ${ALL.length} assets. Manifest: public/brand/manifest.json`);
}
main().catch((e) => {
  console.error("asset generation failed:", e);
  process.exit(1);
});
