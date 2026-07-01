// Oviya engine quality guardrails (Phase 5). Implements docs/ENGINE_QUALITY_AUDIT.md Part 3.
//
// STEP 0 FINDING (live-tested, see the audit doc): fal-ai/nano-banana-pro/edit DOES respect
// negative_prompt. A live A/B (same source image, same positive prompt, same seed conditions,
// resolution:"2K") showed a visible difference: WITHOUT the negative, the output carried a warm
// golden-hour glow/haze and a much shallower, more blurred background; WITH a blur/glow negative,
// the light was flatter and more controlled and the background stayed legible (less "AI blur/glow").
// Both preserved embroidery detail equally well. Conclusion: negatives are NOT a no-op on the hero
// edit model. Guardrails below are therefore BELT AND SUSPENDERS: a strong negative prompt (this
// still helps) PLUS an enforced positive quality block (insurance for any model/path where negatives
// are weaker, and because positive photographic direction is valuable on its own regardless).

import type { Category } from "@/lib/engine/tier";

// ---- 3.1 The enforced positive QUALITY BLOCK ---------------------------------------------------
// Appended to EVERY product generation prompt, both the deterministic fallback (buildPrompt) and
// the Claude compose contract (COMPOSE_SYSTEM instructs Claude to include this near-verbatim).
// Quality is non-negotiable: user direction shapes the SHOOT (pose/light/mood/etc), never the
// baseline sharpness/realism floor.
export const QUALITY_POSITIVE =
  "Shot on a full-frame camera with a prime lens, crisp critical focus on the product, high " +
  "micro-contrast and fine detail, true-to-life sharpness across the garment, controlled even " +
  "studio or location lighting with clean specular highlights and no bloom, neutral accurate " +
  "colour, natural matte skin with visible pores, correct hands and anatomy, deep clean shadows, " +
  "no haze. The fabric weave, stitching, embroidery and any zari, mirror-work or beadwork are " +
  "rendered sharp and individually resolved, never smoothed or melted together.";

// ---- 3.4 The Oviya HOUSE_GRADE (consistent premium finish, run to run) -------------------------
// Mirrors the brand asset script's GRADE constant so product shoots and brand imagery share one
// recognizable signature. The user's mood/grade control MODULATES this, it never replaces it.
export const HOUSE_GRADE =
  "Oviya house finish: rich controlled contrast, gently desaturated, a warm shadow with a clean " +
  "highlight roll-off, a faint oxblood-and-cream undertone in the grade, film-like, gallery-print " +
  "quality, no glow.";

// ---- 3.1 / 3.8 Per-category sharpen + preservation guidance -------------------------------------
export const CATEGORY_QUALITY: Record<Category, string> = {
  apparel:
    "Every motif and thread of any embroidery, zari, mirror-work or bandhani is individually " +
    "resolved with accurate metallic specular highlights, never melted or averaged into a blur. " +
    "The weave, drape and stitching stay crisp at full resolution.",
  jewellery:
    "Every facet and prong is crisp and hard-edged, with accurate gemstone refraction and metal " +
    "specular highlights. No glow or bloom on the stones or metal, no floating elements, no " +
    "invented facets not present in the reference.",
  accessory:
    "The material grain, hardware, stitching and any logo are rendered sharp and legible. Avoid " +
    "depth of field so shallow that it blurs hardware or stitching detail.",
};

// ---- 3.2 Hard anti-slop / anti-blur / anti-glow negative additions ------------------------------
// Extends src/lib/director/prompts.ts ANTI_SLOP_NEGATIVE. Kept here so the term lists are reviewable
// and testable independent of the prompt-assembly module.
export const ANTI_BLUR_NEGATIVE =
  "soft focus, out of focus, defocused, motion blur, smudged, mushy detail, low detail, lacking " +
  "detail, blurry background mush, low resolution, upscale artifacts";

export const ANTI_GLOW_NEGATIVE =
  "bloom, haze, hazy, halo, glow, HDR, HDR look, overexposed, blown highlights, washed out, milky, " +
  "low local contrast, dreamy, ethereal, soft glow, rim-light halo, lens flare, god rays, everything " +
  "glowing";

export const ANTI_AI_SLOP_NEGATIVE =
  "AI look, CGI, 3d render, video game render, overprocessed, over-sharpened halos, ringing " +
  "artifacts, oversaturated colour, plastic, waxy, airbrushed, instagram filter, cartoon, illustration";

// ---- 3.7 Free-text sanitation -------------------------------------------------------------------
// User free text is authoritative for DIRECTION (Phase 2 item 4) but must never be able to inject
// slop-stacking prompt spam or override the quality baseline. Strips known slop-stacking tokens and
// collapses the resulting whitespace/punctuation; the remaining direction still passes through.
const SLOP_TOKENS =
  /\b(8k|4k resolution|16k|hyper[\s-]?realistic|ultra[\s-]?realistic|ultra[\s-]?detailed|hyper[\s-]?detailed|masterpiece|best quality|award[\s-]?winning|trending on \w+|artstation|octane render|unreal engine|unreal 5|cinema4d|redshift render|highly detailed|extremely detailed|professional photography,?|studio quality,?|stunning,?|beautiful,?|gorgeous,?|breathtaking,?|epic,?|insane detail|dslr,?|8k uhd)\b/gi;

export function sanitizeFreeText(text: string | undefined | null): string {
  if (!text) return "";
  const stripped = text
    .replace(SLOP_TOKENS, "")
    .replace(/[,;]{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;.]+|[\s,;.]+$/g, "")
    .trim();
  return stripped;
}

// ---- 3.6 (via 6) Fidelity latitude -> a real strength/denoise parameter -------------------------
// The UI's "creative latitude <-> preserve product" slider (0..100, higher = more strict/preserve).
// COMPOSE_SYSTEM already documents the convention "lower strength preserves more of the source" for
// edit/img2img passes; this makes it real instead of prose. Clamped so latitude can never push the
// model to fully ignore the reference (min ceiling) or fully freeze it (max floor stays an edit).
// Live-confirmed (Step 0 extension, docs/ENGINE_QUALITY_AUDIT.md): fal-ai/nano-banana-pro/edit
// accepts a `strength` field without error (the request succeeds). This was checked separately
// before defaulting latitude=85 -> strength on every Studio request, since sending an unverified
// field to the primary Hero path on every generation would have been a real regression risk if it
// had been rejected. Whether it produces a strong VISUAL effect is not separately confirmed here.
export function strengthFromLatitude(latitudePercent: number | undefined): number | undefined {
  if (typeof latitudePercent !== "number" || Number.isNaN(latitudePercent)) return undefined;
  const clampedPct = Math.min(100, Math.max(0, latitudePercent));
  const raw = 1 - clampedPct / 100; // 100% strict -> 0 (max preserve); 0% strict -> 1 (max creative)
  return Math.min(0.85, Math.max(0.15, raw));
}

// ---- 3.3 Resolution floor -------------------------------------------------------------------
// Confirmed live (Step 0): fal-ai/nano-banana-pro/edit accepts resolution:"2K" and returns a
// 2K-class image. This is the hero/replace floor; never omit resolution on those needs.
export const HERO_MIN_RESOLUTION: "1K" | "2K" | "4K" = "2K";
// For image_size-based slugs (Seedream draft, GPT-image-2 edit), floor the short edge so a small
// preset (e.g. 1080 story) never renders softer than necessary.
export const MIN_SHORT_EDGE = 1536;

export function floorImageSize(size: { width: number; height: number }): { width: number; height: number } {
  const shortEdge = Math.min(size.width, size.height);
  if (shortEdge >= MIN_SHORT_EDGE) return size;
  const scale = MIN_SHORT_EDGE / shortEdge;
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}
