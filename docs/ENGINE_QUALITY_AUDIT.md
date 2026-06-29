# Oviya — Engine Quality Audit (read-only)

Scope: trace the full generation path, find every place output quality leaks (slop, blur, glow,
fidelity loss), and specify the guardrails + upgrades to make output genuinely premium. No code was
changed and no generations were run. Where a claim can only be confirmed by generating, it is marked
**[needs a live test]**.

The headline finding up front: the structural fidelity work (reference-locked routing, anti-collage,
the gate) is solid, but the engine has **almost no positive control over photographic quality** and
**no defense against blur/glow at all**. There is no resolution floor on the premium path, no
camera/lens/sharpness direction by default, the negative prompt may be a no-op on the main model, the
fidelity gate explicitly ignores detail/sharpness, and the **default quality is the cheap/weaker
model**. These compound into the "AI look."

---

## PART 1 — The full generation intelligence

Request flow (still): `POST /api/shots` (`src/app/api/shots/route.ts`) → `runShot`/`runShoot`/
`runReplaceVideo` (`src/lib/engine/run-shot.ts`) → `directShot` (`src/lib/director/index.ts`) →
Analyze → Compose → Route → `runJob` (`src/lib/engine/run.ts`) → `runSync` (`src/lib/engine/fal.ts`,
`fal.subscribe`) → store → fidelity gate → settle. Video is async via the worker.

### 1. Analyze — `src/lib/director/analyze.ts`, prompt in `src/lib/director/prompts.ts`
Model: `claude-opus-4-8` (`DIRECTOR_MODEL`, `src/lib/director/client.ts`), forced tool use, images
before text, `max_tokens: 4000`. System prompt (`ANALYZE_SYSTEM`):

> "You are Drape's product analyst... extract its exact, observable attributes... Report only what
> you can actually see. If a field is not readable, return null... Never guess. Return values EXACTLY
> as observed... Per-field confidence from 0 to 1..."

Structured fields (`ANALYSIS_TOOL`): `product_category`, `garment_subtype`, `primary_color_name/hex`,
`secondary_colors`, `fabric`, `weave_or_knit`, `sheerness`, `reflectivity` (matte/satin/metallic),
`print_or_pattern`, `print_scale`, `embroidery_type`, `embellishments[]`, `construction{neckline,
sleeve, hem, closures, fit, drape_behavior}`, `hardware[]`, `text_or_logos[]`, `jewellery{metal_type,
stone_type, setting, engraving_text}`, `confidence{}`, `recommended_shot_types`, `recommended_looks`.
Cached per product image on `drape_products` (`getOrAnalyzeProduct`).

What it gets right: a genuinely rich, fashion-literate schema including embroidery, weave, zari-class
embellishments, jewellery metal/stone. What it misses: **only `product_category`, `primary_color_name`,
`confidence`, `recommended_looks` are required** — everything that protects fine detail
(`embroidery_type`, `weave_or_knit`, `print_scale`, `embellishments`) is optional and is dropped when
the model returns null or low confidence. There is **no detail-region pass** (no crop-in on the
embroidery/zari/facets), so subtle surface detail is described in words at best, never with spatial
precision. Accuracy is **[needs a live test]**.

### 2. Compose — `src/lib/director/compose.ts` (Claude) + `src/lib/director/fallback.ts` (deterministic) + `src/lib/shot/compose.ts` (`buildPrompt`)
`COMPOSE_SYSTEM` (`prompts.ts`) is the live brain when `ANTHROPIC_API_KEY` is set. Key clauses:

> "positive_prompt: long and fidelity-locked. RE-STATE the exact product from the analysis as
> preservation locks... 'preserve the exact [primary_color_name] ([primary_color_hex]) [fabric]
> [garment_subtype] with [print_or_pattern] and [embroidery_type]... reproduce the stitching, drape
> and neckline faithfully; do not reinvent the product.' Fill only attributes that are present."
> "SINGLE-SUBJECT LOCK (critical): the output is ALWAYS one cohesive photograph... NEVER... collage,
> grid, split screen..." "Reference roles by image position..." "MULTIPLE PRODUCTS: ... compose ALL
> of them onto the SAME single model..." "FREE TEXT IS AUTHORITATIVE... if free text conflicts with a
> preset, the free text wins." "negative_prompt: 10 to 30 anti-slop terms."

Fidelity enforcement (deterministic, `src/lib/shot/compose.ts`): `fidelityClause(category)` always
appended, e.g. apparel:

> "Preserve the exact garment from the reference image: colour, fabric texture, weave, drape,
> stitching, prints, embroidery, zari, mirror work and any logos. Do not reinvent the product;
> reproduce it faithfully."

jewellery: "metal tone, every facet, gemstone colour and cut, engravings and settings." Plus the
realism guardrail sentence: "Natural, realistic result with lifelike skin and hands. No plastic skin,
no distortion, no artificial smoothness." Reference roles + anti-collage via `referenceRolesClause` +
`ANTI_COLLAGE`. Fabric physics via `FABRIC_PHYSICS` map (cotton/silk/georgette/denim/velvet/etc).

Negative prompt (`ANTI_SLOP_NEGATIVE`, `prompts.ts`):

> "plastic skin, waxy skin, poreless, airbrushed, over-smoothed, mannequin, doll-like, extra fingers,
> fused fingers, missing fingers, melting hands, deformed hands, warped fabric, distorted print,
> smeared pattern, floating jewellery, duplicated logo, garbled text, uncanny face, asymmetric eyes,
> blurry, lowres, jpeg artifacts, oversaturated, collage, grid, split screen, multiple panels,
> picture-in-picture, contact sheet, photo of a photo, before and after, duplicated person, two
> people where there should be one"

Parameters: in `route.ts` the built `falInput` is only `{ prompt, num_images, negative_prompt?,
resolution?, image_size?, aspect_ratio?, strength? }`. **There is no steps, guidance/CFG, sampler,
scheduler, or seed anywhere.** The fallback sets `resolution: "2K"` for `image/hero` and an
`image_size` for the others; the Claude path may set `resolution` 1K/2K/4K or omit it.

### 3. Route — `src/lib/shot/plan.ts` (`planNeed`, the single cost-bearing decision) + `src/lib/director/route.ts` (attaches refs)
`planNeed`: replace-video → `video/replace`; replace-image → `image/replace`; saved-model + apparel +
on-model + single product → `tryon`; multi-product → `image/hero`; quality `standard` → `image/standard`;
edit shot types → `image/edit`; else → `image/hero`. `route.ts` attaches the product image(s) to the
correct field per `refShape`, guards that a reference is present, and forbids text-to-image.

### 4. The fal models — `src/lib/engine/registry.ts`
| Need | Slug | refShape | unit cost (¢) | role |
| --- | --- | --- | --- | --- |
| image/standard | `fal-ai/bytedance/seedream/v4.5/edit` | image_urls | 4 | **Draft, the DEFAULT** |
| image/hero | `fal-ai/nano-banana-pro/edit` | image_urls | 15 | Premium fidelity |
| image/edit | `openai/gpt-image-2/edit` | image_urls | 15 | masked region edits |
| image/replace | `fal-ai/nano-banana-pro/edit` | image_urls | 15 | product swap into a scene |
| tryon | `fal-ai/fashn/tryon/v1.6` | tryon | 8 | garment on a saved model |
| video/standard, video/replace | `fal-ai/kling-video/v3/pro/image-to-video` | start_image | 11.2/s | i2v |
| video/hero | `fal-ai/veo3.1` | start_image | 40/s | **registered, unreachable** |
| bg-remove | `fal-ai/bria/background/remove` | image_url | 2 | **registered, unreachable** |
| upscale/video | `fal-ai/topaz/upscale/video` | image_url | 8/s | **registered, unreachable** |

Model creation (`src/lib/models/generate.ts`): base angle `fal-ai/bytedance/seedream/v4.5/text-to-image`
at `image_size {1536x2048}`; the other 3 angles `fal-ai/nano-banana-pro/edit` at `resolution: "2K"`.

### 5. Fidelity gate — `src/lib/director/gate.ts`, prompt `GATE_SYSTEM`
`claude-opus-4-8`, source (Image 1) vs output (Image 2), `max_tokens: 1024`, returns
`{match, color_ok, pattern_ok, garment_ok, reasons[]}`. Prompt:

> "Judge only the product itself: colour, print/pattern, and garment/piece identity. Ignore the
> model, pose, background, and lighting. Be strict: a recoloured or restyled product is a FAIL."

`run.ts` loops it over **every** product (multi-product), refunds + fails the whole shot on the first
non-match. It does **not** run on video.

### 6. Video — `/api/video`, `/api/jobs/[id]/video`, `run-shot.runReplaceVideo`, worker
i2v on Kling v3 pro, `start_image_url` = the approved/swapped still, `prompt` = a motion line, `duration`
= seconds (5-8). Example (`/api/video`): "Animate naturally with {motion}... Preserve the product
exactly across every frame... Keep it the locked anchor." No motion-strength, cfg, or fps params. The
worker (`worker/index.ts`) submits `payload.falInput` verbatim with a webhook.

---

## PART 2 — Every quality leak (cited)

### A. Premium is not the default (model choice) — HIGH
- The Studio defaults `quality` to **"standard"** (`src/components/Studio.tsx`, the Draft/Hero seg
  defaults to Draft), and `planNeed` sends `standard` to **Seedream 4.5 edit** (the 4¢ model). So the
  out-of-box output uses the cheaper, weaker model. Seedream edit is more prone to softening and slop
  than Nano Banana Pro. **The default experience is the lowest-quality path.**
- `tryon` (FASHN v1.6) is auto-selected for apparel + saved model. Try-on models are tuned for garment
  placement, not editorial fidelity, and tend to **soften fabric texture and flatten embroidery/zari**.
  A saved-model apparel shoot silently routes to the model least able to hold ethnic surface detail.
  **[needs a live test]** to quantify, but the routing choice is a known risk.

### B. No defense against BLUR — HIGH
- The negative prompt has only "blurry, lowres, jpeg artifacts". It is missing the whole blur family:
  soft focus, out of focus, motion blur, smudged, mushy, low detail, lacks detail, defocused, hazy.
- There is **no resolution floor**. `image/hero` gets `2K` only via the deterministic fallback; on the
  Claude compose path `resolution` is whatever Claude sets and **may be omitted → the model's default
  (often 1K)** → softer detail. `image/standard` never sets `resolution` at all. **[needs a live test]**
  to confirm the per-model default, but nothing in code guarantees a high render resolution.
- **No still upscaler.** `upscale/video` exists but there is no still upscale anywhere, so effective
  resolution is whatever the model returns; lost weave/stitch detail is never recovered.
- Shallow depth of field is offered as a control (`DEPTH_OF_FIELD` incl. "ultra-shallow-bokeh",
  `src/lib/shot/spec.ts`) and the journey/landing celebrate "shallow depth of field" — DoF is a classic
  way the model **hides** failure by blurring everything but a sliver. Nothing flags or limits this.

### C. No defense against GLOW — HIGH
- **Nothing in the negative prompt addresses glow at all.** Missing: bloom, haze, halo, glow, hazy,
  HDR, overexposed, blown highlights, milky, washed out, low contrast, rim-light halo, lens flare,
  god rays, dreamy, ethereal, soft glow. The telltale "everything is luminous" AI look is completely
  undefended.
- The positive prompts lean into glow risk: `LIGHTING_TEXT` (`src/lib/shot/compose.ts`) offers
  "butterfly beauty", "golden-hour rim", "diffused tent with a sparkle spot"; the brand voice and
  landing lean luminous. No counter-direction toward crisp contrast, controlled highlights, matte
  rendering.

### D. Weak positive photographic direction (slop) — HIGH
- `buildPrompt` produces fashion-literate but **photographically vague** prompts: it names model,
  pose, background, lighting, vibe and the fidelity lock, but by default has **no camera, no lens/focal
  length, no aperture, no shutter, no film/sensor language, no sharpness/contrast/micro-contrast
  direction, no "shot on" cue.** Lens/angle/DoF only enter when an Advanced user sets them (folded via
  free-text); the **Basic/default shoot has none of it**.
- `REALISM_POSITIVE` is decent ("visible pores... lifelike hands... sharp true-to-source fabric
  detail") but is only included on the fallback path's prompt assembly; the Claude path is *instructed*
  to add realism positives but it is not guaranteed verbatim. No single enforced realism block.

### E. The negative prompt may be largely inert — HIGH / **[needs a live test]**
- `route.ts` always sends `negative_prompt`, but the primary models are prompt-driven edit models:
  **`fal-ai/nano-banana-pro/edit` and `openai/gpt-image-2/edit` likely ignore `negative_prompt`** (it is
  not a documented field for those slugs). If so, the entire anti-slop negative library is a no-op on
  the hero and replace paths, and only Seedream (Draft) and FASHN may honor it. This must be verified
  against each live slug's input schema; if true, all anti-slop intent must move into the **positive**
  prompt for those models.

### F. Free-text can inject slop — MEDIUM
- `COMPOSE_SYSTEM`: "FREE TEXT IS AUTHORITATIVE... if free text conflicts with a preset, the free text
  wins." There is **no sanitization**: a user pasting "8k, hyperrealistic, ultra detailed, beautiful,
  stunning, octane render, trending on artstation" injects classic slop-stacking straight into the
  prompt, and the system is told to obey it. `freeText.latitude` is also injected as plain text
  ("keep the product about N percent strict") with no real binding to a strength param.

### G. Fidelity gate ignores detail, sharpness, and the AI look — HIGH
- `GATE_SYSTEM` checks "colour, print/pattern, and garment/piece identity" and explicitly says "Ignore
  the model, pose, background, and lighting." It does **not** check embroidery/zari/stitch/weave/facet
  preservation, surface texture, sharpness, blur, glow, or plastic skin. So a result that keeps the
  colour and silhouette but **smooths away the chikankari, melts the zari, or has the glow** passes the
  gate. The trust backbone validates the gross product but not the premium qualities.
- The gate is also coarse-grained: it compares full frames, not a detail crop, so subtle texture loss
  is hard for it to see even if asked. No per-product verdict surfaced to the UI (documented gap).

### H. Parameter + sizing gaps — MEDIUM
- No `seed` anywhere → "make a variation" and multi-output rely purely on model nondeterminism, with no
  controlled variation or reproducibility.
- `route.ts` passes `resolution` AND `image_size` AND `aspect_ratio` generically; the correct field
  differs per slug (Nano Banana Pro: `resolution` + aspect; Seedream: `image_size`; GPT-image-2: its
  own `size`). Wrong-named fields are silently ignored → the model falls back to its default size.
  **[needs a live test]** per slug to confirm each size actually takes effect.
- `num_images` defaults to 1; multi-output is N separate jobs (good for art direction) but each is a
  fresh nondeterministic render with no shared seed/style lock → **consistency drift across the set**.

### I. No house look / consistency baseline — HIGH
- The Gemini **brand** asset script (`scripts/generate-assets-v4.ts`) has a strong shared `GRADE`
  constant ("rich controlled contrast, gently desaturated, warm shadow, clean highlight roll-off,
  oxblood-and-cream undertone, film-like"). **The product engine has no equivalent.** Each shoot's
  grade/contrast/look is whatever Claude composes plus the user's controls. There is no enforced
  Oviya house grade, so outputs do not share a recognizable premium signature and drift between slop
  and editorial run to run.

### J. Video quality is thin — MEDIUM
- The i2v prompt is a single generic motion line; no negative prompt, no motion-strength, no fps, no
  "preserve texture/sharpness across frames" beyond "preserve the product." i2v commonly **softens and
  adds temporal glow**; nothing defends against it. Gate does not run on video, so drift across frames
  is unchecked. (Video is Beta and worker-gated, so lower urgency.)

---

## PART 3 — Improvement + guardrail spec

### 3.1 A single enforced QUALITY BLOCK (positive), appended to every still prompt
Because negatives may be inert on the main models (finding E), put the defense in the positive prompt.
Add a constant (e.g. `QUALITY_POSITIVE` in `prompts.ts`) appended by both `buildPrompt` and the Claude
compose contract:

> "Shot on a full-frame camera with a prime lens, crisp critical focus on the product, high
> micro-contrast and fine detail, true-to-life sharpness across the garment, controlled even studio
> lighting with clean specular highlights and no bloom, neutral accurate colour, natural matte skin
> with visible pores, deep clean shadows, no haze. The fabric weave, stitching, embroidery and any
> zari, mirror-work or beadwork are rendered sharp and individually resolved."

Per-category sharpen line (apparel: "weave and stitch individually resolved"; jewellery: "every facet
and prong crisp, accurate metal specular, no glow on the stones"; accessory: "grain, hardware and
stitching sharp").

### 3.2 Hard anti-slop / anti-blur / anti-glow negative set (and move it positive where ignored)
Extend `ANTI_SLOP_NEGATIVE` and, for models that ignore negatives, fold the inverse into the positive:
- Blur: "soft focus, out of focus, defocused, motion blur, smudged, mushy, low detail, lacking detail,
  blurry background mush".
- Glow: "bloom, haze, halo, glow, hazy, HDR, overexposed, blown highlights, washed out, milky, low
  contrast, dreamy, ethereal, rim-light halo, lens flare, god rays".
- Slop: "AI look, CGI, render, 3d render, video-game, overprocessed, over-sharpened halos, oversaturated,
  plastic, waxy, airbrushed, instagram filter".
- Keep the existing hands/collage/anatomy set.

### 3.3 Parameter recommendations (per model) — verify live, then lock
- **Nano Banana Pro (hero/replace):** force `resolution: "2K"` minimum (offer `4K` on Hero); confirm it
  honors `aspect_ratio`; confirm whether `negative_prompt` is read (if not, rely on the positive
  quality block). Never omit resolution.
- **Seedream 4.5 (draft + model base):** set an explicit high `image_size` (e.g. 1536×2048+); confirm
  `negative_prompt` support; confirm a guidance/steps field exists and, if so, tune for sharpness, not
  smoothness. **[needs a live test]** for the exact field names.
- **GPT-image-2 edit:** use its native `size`/`quality` ("high") params; do not rely on `resolution`.
- Add a **still upscaler pass** (a fal upscaler such as a Topaz/clarity-style image model) on Hero to
  recover weave/stitch detail; gate it so it sharpens without inventing texture.
- Introduce an optional **seed** for reproducible variations and a shared seed-family across a
  multi-output shoot for consistency.

### 3.4 House look baseline
Define an Oviya `HOUSE_GRADE` constant (mirror the brand asset `GRADE`) and append it to every product
prompt: "rich controlled contrast, gently desaturated, warm shadow and clean highlight roll-off, a
faint oxblood-and-cream undertone, film-like, gallery-print quality, no glow." This gives every output
a recognizable, premium, consistent signature. Make the user's mood/grade control *modulate* the house
baseline rather than replace it.

### 3.5 Fidelity-gate upgrades
- Expand `GATE_SYSTEM` to also judge: embroidery/zari/print/weave/stitch **detail preservation**,
  surface texture, **sharpness vs blur**, and the **AI look (plastic skin / glow / waxiness)**. Add
  boolean fields `detail_ok`, `sharp_ok`, `no_ai_look` and fail on any.
- Run the gate on a **detail crop** of the product region in addition to the full frame, so subtle
  texture loss is visible.
- Surface a per-product verdict to the UI (closes a documented gap).
- Consider a cheap automated sharpness/contrast heuristic (variance-of-Laplacian style) as a pre-gate
  blur tripwire before spending a Claude vision call. **[needs a live test]**.

### 3.6 Routing for quality
- Make **Hero the default** for the first shoot (premium-by-default), with Draft as an explicit opt-down
  for iteration. At minimum, never let the default land on Seedream for a hero-intent shoot.
- Reconsider `tryon` for ethnic apparel with heavy surface detail: route saree/lehenga/heavy-zari to
  Nano Banana Pro multi-reference (identity + garment) with the anti-collage lock instead of FASHN, and
  reserve FASHN for plain garments where placement matters more than texture. **[needs a live test]** to
  compare FASHN vs Nano Banana on zari/chikankari.

### 3.7 Free-text sanitation
Strip or down-weight known slop-stacking adjectives ("8k, hyperrealistic, ultra detailed, masterpiece,
trending, octane, unreal engine, beautiful, stunning") from user free-text before it reaches the prompt,
or instruct compose to translate intent without copying slop tokens verbatim. Bind `latitude` to a real
`strength` param on edit/img2img passes rather than passing it as prose.

### 3.8 Per-category guidance (summary)
- **Apparel:** lock weave + drape + stitch; for ethnic (zari/chikankari/mirror/bandhani) add explicit
  "each motif/thread individually resolved, metallic zari with accurate specular, no melted embroidery".
- **Jewellery:** lock metal tone + facet + setting; "crisp facets, accurate gemstone refraction, no
  glow/bloom on stones, no floating elements"; keep on a controlled macro with hard-edged speculars.
- **Accessories:** lock material grain + hardware + stitching + logo; avoid DoF that hides hardware.

---

## PART 4 — Codebase health

- **Dead code:** `src/components/LoadingStudio.tsx` is now unused (replaced by `AtelierLoader`);
  `src/lib/shot/loading.ts` (its stage/line data) is likely unused too. Registry needs `bg-remove`,
  `video/hero`, `upscale/video` are **registered but unreachable** from `planNeed`/endpoints (future or
  dead). `MOTION_PRESETS`/`motionsForCategory` are still referenced (video). No broken imports found in
  the read paths.
- **Runtime dependencies / drift:** migration `0005_drape_saved_products.sql` must be applied or the
  save-product paths error (guarded, but the columns are assumed by `drape_products` types). Video is
  gated on the Railway worker (`DRAPE_VIDEO_ENABLED` + `npm run worker`); off by default, fails clean.
  Registry slug, route field, and worker `SLUGS` must stay in agreement (they currently do, including
  `video/replace`).
- **The three documented engine capability gaps (restated):**
  1. **No frame-exact video product-swap** — `video/replace` re-synthesizes motion via i2v from the
     swapped still; the product is locked but the source's exact motion is not lifted frame-by-frame.
  2. **Same-product multi-angle is not a first-class mode** — `referenceImagePaths` models distinct
     articles; passing multiple angles of one product is preserved but not explicitly modeled.
  3. **The fidelity gate fails the whole shot** on the first product that drifts and returns no
     per-product breakdown to the UI.
- **What would undermine the UI pass:** the quality leaks above are invisible to the UI but define how
  good the output looks; shipping the premium UI over a Draft-by-default, blur/glow-undefended engine
  will read as "pretty shell, AI output." Fix the quality block + house grade + Hero-default + gate
  upgrades before or alongside the UI polish.

---

## Top fixes, ranked
1. **Premium-by-default routing** (Hero default; keep Seedream as opt-down) — biggest single quality win.
2. **Enforced positive QUALITY BLOCK + HOUSE_GRADE** on every prompt (defends slop/blur/glow even where
   negatives are ignored, and gives a consistent house look).
3. **Verify negative-prompt support per slug** and relocate anti-slop into the positive where ignored
   **[needs a live test]**.
4. **Resolution floor (2K hero) + a still upscaler** for detail recovery.
5. **Fidelity-gate upgrade** to catch detail loss, blur, and the AI look (detail-crop + new booleans).
6. **Free-text slop sanitation** and binding `latitude` to a real strength param.
7. **tryon vs Nano Banana** comparison for heavy ethnic detail **[needs a live test]**.
