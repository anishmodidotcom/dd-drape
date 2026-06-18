// Wave 1 preset thumbnail generator (Phase F). Generates a curated hero thumbnail set on a single
// consistent base model + neutral garment (so the gallery reads as a coherent system), uploads to
// the public drape-presets bucket, writes the manifest, and logs total spend.
//
//   node scripts/gen-presets.mjs
//
// Keep counts tight: this is a curated set, not the full library. Galleries use the cheap edit
// slug ($0.04) conditioned on the base model for consistency.

import { readFileSync, writeFileSync } from "node:fs";
import { fal } from "@fal-ai/client";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.trimStart().startsWith("#")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);
fal.config({ credentials: env.FAL_KEY });
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;

const T2I = "fal-ai/bytedance/seedream/v4.5/text-to-image";
const EDIT = "fal-ai/bytedance/seedream/v4.5/edit";
const REALISM = "natural realistic skin with visible texture, lifelike hands, sharp fabric detail, premium editorial fashion photography";
const NEG = "plastic skin, waxy, airbrushed, extra fingers, melting hands, warped fabric, text, watermark, busy clutter";

let spendCents = 0;

async function genT2I(prompt) {
  spendCents += 4;
  const r = await fal.subscribe(T2I, { input: { prompt, image_size: { width: 1024, height: 1365 } }, logs: false });
  return r.data?.images?.[0]?.url;
}
async function genEdit(prompt, baseUrl) {
  spendCents += 4;
  const r = await fal.subscribe(EDIT, { input: { prompt, negative_prompt: NEG, image_urls: [baseUrl] }, logs: false });
  return r.data?.images?.[0]?.url;
}
async function upload(path, url) {
  const res = await fetch(url);
  const bytes = Buffer.from(await res.arrayBuffer());
  const up = await fetch(`${SB}/storage/v1/object/drape-presets/${path}`, {
    method: "POST",
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "image/png", "x-upsert": "true" },
    body: bytes,
  });
  if (!up.ok) throw new Error(`upload ${path} failed ${up.status}: ${(await up.text()).slice(0, 120)}`);
  return path;
}

// The tight Wave 1 set. Each gallery entry edits the base model so identity stays consistent.
const POSES = {
  "s-curve": "standing in a relaxed S-curve, weight on one leg",
  walking: "walking in mid-stride toward camera",
  "hand-to-collarbone": "one hand resting at the collarbone",
  "seated-regal": "seated in a regal upright pose",
  "over-shoulder-back": "viewed over the shoulder showing the back",
  "candid-laughing": "candidly laughing, relaxed",
};
const LIGHTING = {
  "soft-two-zone": "soft two-zone studio lighting",
  "butterfly-beauty": "butterfly beauty lighting from above",
  rembrandt: "dramatic Rembrandt lighting with a cheek triangle",
  "natural-golden-hour": "warm natural golden-hour window light",
  "diffused-tent-sparkle": "diffused light-tent with a small sparkle spot",
};
const SETS = {
  white: "a clean pure white seamless studio background",
  "heritage-interior": "a lived-in Indian heritage interior with carved wood",
  "urban-street": "a moody urban street at dusk",
  "natural-outdoor": "a soft natural outdoor garden setting",
};
const MAKEUP = {
  "natural-fresh": "fresh natural makeup, dewy bare skin",
  "heavy-kohl-bridal": "bridal makeup with heavy kohl-lined eyes",
  editorial: "bold editorial makeup with a strong lip",
};
const HAIR = {
  open: "hair worn open in soft waves",
  updo: "hair in a sleek updo exposing the neck",
  braided: "a neat braided hairstyle",
};
const PRESETS = {
  "marketplace-clean": "clean ecommerce full-length on pure white, soft even light, natural makeup",
  "festive-editorial": "festive editorial in a heritage interior, warm diya candlelight, dewy glow",
  "quiet-luxury": "quiet luxury, neutral palette, soft window light, restrained styling",
  "bridal-regal": "bridal and regal, heavy kohl, chiaroscuro light, seated",
  "streetwear-fusion": "streetwear fusion on an urban street, natural light, walking",
  "demi-fine-everyday": "demi-fine everyday, soft close crop, diffused light with a sparkle",
};

async function mapGroup(group, baseUrl, entries, phraseFn) {
  const manifest = {};
  const ids = Object.keys(entries);
  for (let i = 0; i < ids.length; i += 4) {
    const batch = ids.slice(i, i + 4);
    const urls = await Promise.all(batch.map((id) => genEdit(phraseFn(entries[id]), baseUrl)));
    await Promise.all(batch.map((id, k) => urls[k] && upload(`${group}/${id}.png`, urls[k]).then((p) => (manifest[id] = p))));
  }
  console.log(`  ${group}: ${Object.keys(manifest).length}/${ids.length}`);
  return manifest;
}

async function main() {
  console.log("Generating Wave 1 base model...");
  const baseUrl = await genT2I(
    "Full-length fashion photo of a South Asian female model wearing a plain neutral light grey fitted top and tailored trousers, pure white seamless studio background, soft even studio lighting, " + REALISM
  );
  if (!baseUrl) throw new Error("base model failed");
  await upload("base/model.png", baseUrl);

  const manifest = { base: "base/model.png" };
  manifest.poses = await mapGroup("poses", baseUrl, POSES, (v) => `Same model and outfit as the reference image, now ${v}, pure white studio background, ${REALISM}`);
  manifest.lighting = await mapGroup("lighting", baseUrl, LIGHTING, (v) => `Same model and outfit as the reference image, relit with ${v}, ${REALISM}`);
  manifest.sets = await mapGroup("sets", baseUrl, SETS, (v) => `Same model and outfit as the reference image, placed in ${v}, ${REALISM}`);
  manifest.makeup = await mapGroup("makeup", baseUrl, MAKEUP, (v) => `Close-up beauty portrait of the same model as the reference image with ${v}, ${REALISM}`);
  manifest.hair = await mapGroup("hair", baseUrl, HAIR, (v) => `Portrait of the same model as the reference image with ${v}, ${REALISM}`);
  manifest.presets = await mapGroup("presets", baseUrl, PRESETS, (v) => `Same model and outfit as the reference image, styled as ${v}, ${REALISM}`);

  writeFileSync("src/lib/shot/preset-thumbnails.json", JSON.stringify(manifest, null, 2));
  console.log(`\nWave 1 done. Total spend: $${(spendCents / 100).toFixed(2)} (${spendCents / 4} images).`);
  console.log("Manifest written to src/lib/shot/preset-thumbnails.json");
}
main().catch((e) => { console.error("gen-presets failed:", e); process.exit(1); });
