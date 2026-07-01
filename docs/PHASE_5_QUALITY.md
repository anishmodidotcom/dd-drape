# Phase 5 — The engine quality pass

Implements `docs/ENGINE_QUALITY_AUDIT.md` Part 3 (the top-7 fixes) so Oviya's output defaults to
premium studio quality and actively defends against AI slop, AI blur, and AI glow. Build only; no
UI visual redesign in this pass (the `/design` system and Studio UI shell are untouched beyond the
one default-state flip in item 1). Does not regress the director, fidelity gate, ledger, RLS,
taxonomy, or draft persistence.

## Step 0 — the decisive live test (spend: $0.45, under the $1 budget)

Two questions needed a live answer before guardrails could be built correctly, both resolved with
`fal-ai/nano-banana-pro/edit` (the Hero/Replace slug) using the same source product image
(a teal chikankari kurta flat-lay) and the same fidelity-locked positive prompt throughout.

**1. Does `negative_prompt` do anything on the hero edit model?** Ran the identical request twice,
once with a strong blur/glow/plastic-skin negative and once without.

- **Without the negative:** warm golden-hour lighting with a visible glow/haze on the right of the
  frame, and a much shallower depth of field with the background (sofa, cushions) strongly blurred
  away.
- **With the negative:** flatter, controlled, even studio-style light, no glow/haze, background
  stayed present and legible instead of blurred out.
- Both preserved the chikankari embroidery equally sharply, so this was a pure lighting/blur/glow
  comparison, not a fidelity one.

**Finding: negatives ARE respected.** This overturns the audit's "may be a no-op" hedge. Guardrails
were still built belt-and-suspenders (strong negatives **and** an enforced positive quality block),
both because the positive block is independently valuable and because it is the only defense on any
future model/path where negatives might carry less weight.

**2. Does `fal-ai/nano-banana-pro/edit` accept a `strength` field without erroring?** This mattered
because the latitude-binding fix (item 6) would now send `strength` on every Hero request by
default (Studio's latitude control defaults to 85). Sending an unverified field to the primary,
default, money-path model on every request would have been a real regression risk if rejected.
Ran one more generation with `strength: 0.15` added: **the call succeeded, no error.** This
de-risked shipping the binding. (Its visual strength was not separately isolated; only that it does
not break the request.)

Total: 3 live `fal-ai/nano-banana-pro/edit` generations at 15 credits (cents) each = **$0.45**.

## The fixes

### 1. Premium by default (Hero-by-default routing)
The engine's routing brain (`planNeed`, `src/lib/shot/plan.ts`) already defaulted to `image/hero`
whenever `quality` was unset — confirmed by a pre-existing test (`planRoute(base).need` expected
`"image/hero"`). The actual default-quality bug was entirely in the UI: `src/components/Studio.tsx`
initialized `quality` state to `"standard"` (routes to the 4-credit Seedream draft model) and the
draft-hydration fallback did the same. Both now default to `"hero"`. Draft remains one click away
in the same segmented toggle, clearly labeled, never the default. No routing logic changed; only
the out-of-box UI state.
- **Before:** new user's first shoot → Draft (Seedream, 4 credits) → the weakest model by default.
- **After:** new user's first shoot → Hero (Nano Banana Pro, 15 credits) → the strongest model by
  default. `/api/estimate` and the real run share the exact same `planNeed`, so quoted == charged
  is unaffected by this change (only the UI's starting toggle position moved).

### 2. Enforced positive QUALITY BLOCK + Oviya HOUSE_GRADE
New module `src/lib/shot/quality.ts`:
- `QUALITY_POSITIVE` — camera/lens language, "crisp critical focus on the product," fine-detail
  rendering, controlled lighting with "no bloom," natural matte skin, correct hands, and an explicit
  instruction that fabric weave/stitching/embroidery/zari/mirror-work are "rendered sharp and
  individually resolved, never smoothed or melted together."
- `HOUSE_GRADE` — the Oviya house finish (mirrors the brand-asset `GRADE` constant): "rich
  controlled contrast, gently desaturated, warm shadow, clean highlight roll-off, faint
  oxblood-and-cream undertone, film-like, gallery-print quality, no glow."
- `CATEGORY_QUALITY` — per-category sharpen/preservation lines (apparel/jewellery/accessory, see
  fix 7).

`buildPrompt` (`src/lib/shot/compose.ts`) now appends all three, always, on every path (on-model,
product-only, and Replace), verified by a test that free text describing "soft" or "moody, ignore
sharpness" still produces a prompt containing the quality block verbatim. `COMPOSE_SYSTEM`
(`src/lib/director/prompts.ts`) instructs Claude to append the same blocks near-verbatim regardless
of user free text, explicit that quality is non-negotiable while free text still governs direction.

### 3. Hard anti-slop / anti-blur / anti-glow guardrails
`ANTI_SLOP_NEGATIVE` (`src/lib/director/prompts.ts`) extended with the full families the audit
flagged as missing: blur (`ANTI_BLUR_NEGATIVE`: soft focus, out of focus, motion blur, smudged,
mushy detail, low detail, low resolution, upscale artifacts), glow (`ANTI_GLOW_NEGATIVE`: bloom,
haze, halo, glow, HDR, overexposed, blown highlights, washed out, low local contrast, lens flare,
god rays), and AI-slop (`ANTI_AI_SLOP_NEGATIVE`: "AI look", CGI, 3d render, video game render,
over-sharpened halos, plastic, waxy, airbrushed, cartoon). `COMPOSE_SYSTEM` now instructs Claude to
cover all three families explicitly (15-35 terms, up from "10-30 anti-slop terms" with no family
breakdown). Per Step 0, these are real, not decorative.

### 4. Resolution floor + upscaler
- **Resolution floor (live-verified):** `src/lib/director/route.ts` now forces `resolution` to at
  least `"2K"` on `image/hero` and `image/replace` (both `fal-ai/nano-banana-pro/edit`) whenever it
  is unset or under-set to `"1K"`; an explicit `"4K"` is never downgraded. Confirmed live in Step 0
  that `resolution:"2K"` is read and produces a real 2K-class render (1792x2400px output).
  Deliberately **not** forced onto `image/edit` (GPT Image 2): that slug's native size/quality field
  names were not live-verified in this pass, and forcing an unverified field risked a hard rejection
  on a strict API rather than a harmless no-op, which would have regressed the masked-edit path.
  **[needs a live test]** to extend the floor there with the correct field name.
- **Image-size floor:** `floorImageSize()` scales any image-size-based preset (Seedream draft, model
  creation) up to a 1536px minimum short edge, preserving aspect ratio, so a small preset (e.g. the
  1080px Story format) never renders softer than necessary.
- **Still upscaler (feature-flagged, off by default):** `src/lib/engine/upscale.ts`, wired into
  `run.ts` immediately after the fidelity gate passes on Hero/Replace jobs. Verifying an exact fal
  upscaler slug and its input schema was out of the Step 0 budget (that budget was reserved for the
  negative-prompt/strength questions per the task). Rather than guess a slug name and ship an
  unverified integration against the primary money path, the slug is pluggable via
  `DRAPE_UPSCALE_SLUG` (unset by default = fully disabled, zero behavior change). This mirrors the
  codebase's own existing precedent for an unverified slug (`video/hero` -> `veo3.1` in
  `registry.ts`, registered with a "verify before first spend" note, never wired into a reachable
  path until confirmed). **Manual step for Anish:** live-test a fal upscaler slug (e.g. a
  Topaz/clarity-style image model), confirm its input/output field names, then set
  `DRAPE_UPSCALE_SLUG` in the environment to enable it. No extra credit cost: bundled into the
  existing Hero/Replace price.

### 5. Fidelity-gate upgrade
`FidelityVerdict` (`src/lib/director/schema.ts`) gains three fields: `detail_ok`, `sharp_ok`,
`no_ai_look`. `GATE_SYSTEM` and the gate's tool schema (`src/lib/director/gate.ts`) instruct Claude
to judge fine surface-detail preservation (embroidery/zari/weave/facets, not just colour/pattern/
garment identity) as a hard fidelity dimension, and to separately report sharpness and AI-look as
diagnostic signals.

**Calibration** (extracted as a pure, unit-tested function `isFidelityHardOk` in `gate.ts`):
- `detail_ok` joins `match`/`color_ok`/`pattern_ok`/`garment_ok` in the **hard fail+refund** set.
  This directly closes the audit's headline gap: a result that keeps the right colour and silhouette
  but smooths away the chikankari or melts the zari now fails the gate and refunds, instead of
  silently passing.
- `sharp_ok` and `no_ai_look` are **diagnostic-only**: recorded on the job (via an extended
  `setJobFidelity(job, "verified", { verdicts })` that stashes the full per-product verdict array in
  job metadata, closing part of the "no per-product verdict surfaced" gap) but never trigger a
  refund. Judging sharpness/glow from a single vision pass is more subjective than judging colour or
  detail-loss; hard-failing on it risked over-refunding genuinely good, faithful shots. This is the
  requested calibration against false-fails.
- `run.ts`'s multi-product loop uses the same hard-fail check per product, so a multi-product shot
  still fails+refunds on the first product whose detail (not just colour) drifts.

### 6. Free-text sanitation + latitude binding
- **Sanitation:** `sanitizeFreeText()` (`quality.ts`) strips slop-stacking tokens (8k/4k/16k,
  hyperrealistic, ultra/hyper-detailed, masterpiece, award-winning, "trending on X", artstation,
  octane/unreal/redshift render, "highly/extremely detailed", generic "stunning/beautiful/gorgeous/
  epic" stacking) via regex, applied to both the deterministic `buildPrompt` path and available to
  the Claude compose path (`COMPOSE_SYSTEM` is instructed to translate intent rather than parrot
  these tokens verbatim even if the user typed them).
- **A real gap closed in passing:** `buildPrompt` previously never read `spec.freeText`/
  `spec.freeBrief` at all — on the deterministic fallback path (no `ANTHROPIC_API_KEY`, or a Claude
  error), a user's free-text direction was silently dropped from the actual generation prompt. It
  now folds sanitized free text into every prompt via `freeTextClause()`, always placed before the
  non-negotiable quality block so direction never dilutes it.
- **Latitude binding:** `latitude` is now a first-class `ShotSpec` field (was previously smuggled
  into `freeText.latitude` as unbound prose: "keep the product about N percent strict"). New
  `strengthFromLatitude()` maps the 0-100 slider to a real `strength` parameter (documented
  convention already in `COMPOSE_SYSTEM`: "lower strength preserves more of the source"), clamped to
  `[0.15, 0.85]` so latitude can never fully freeze the render (useless) or fully ignore the
  reference (breaks fidelity). Bound deterministically in `directShot`
  (`src/lib/director/index.ts`), the same "one source of truth, Claude doesn't get final say" point
  where `model_route` is already overridden. Live-verified in Step 0 that the field is accepted by
  the Hero slug without error before defaulting it on for every request.

### 7. Per-category guidance
`CATEGORY_QUALITY` in `quality.ts` (apparel/jewellery/accessory) is appended to every prompt (see
fix 2). Apparel: "every motif and thread of any embroidery, zari, mirror-work or bandhani is
individually resolved with accurate metallic specular, never melted or averaged into a blur."
Jewellery: "every facet and prong is crisp and hard-edged... no glow or bloom on the stones or
metal, no floating elements." Accessories: material grain/hardware/stitching sharp, "avoid depth of
field so shallow that it blurs hardware or stitching detail."

**Heavy-ethnic-detail routing:** the audit's FASHN-vs-Nano-Banana comparison was **not** live-tested
(that spend was reserved for the negative-prompt/strength questions). Per the audit's own
allowance ("otherwise document it as needs-more-testing and pick the safer default"), `planNeed`
(`src/lib/shot/plan.ts`) now routes saved-model shots on heavy-ethnic-detail sub-types (saree,
lehenga, anarkali, sherwani, salwar) to the identity-locked Hero multi-reference edit instead of
FASHN try-on, reusing the existing anti-collage/reference-roles machinery. This is the safer default
the audit already reasoned through (3.6): reserve FASHN for plain garments where placement matters
more than texture. **[needs a live test]** (an actual FASHN vs Nano Banana A/B on a zari/chikankari
piece) to confirm and potentially relax. Cost note: this correctly *raises* the price for these
sub-types (8 -> 15 credits) since a better model costs more; `/api/estimate` and the real run share
`planNeed`, so quoted == charged holds by construction. Plain garments (kurta, shirt, etc.) are
unaffected and still route to the cheaper try-on model.

## Gate
- `tsc --noEmit`: clean.
- `vitest run`: **159 passed**, 15 live-only skipped (33 new tests in `__tests__/quality.test.ts`
  covering: the quality block always applied across every prompt path incl. Replace and free-text
  attempts to dilute it; Hero-default routing at both the engine and the UI-source level; free-text
  sanitation end to end through `buildPrompt`; latitude-to-strength binding and its clamp; the
  resolution floor via a real `route()` call including the never-downgrade-4K case; the fidelity-gate
  calibration - detail loss hard-fails, sharpness/glow alone never do; and the heavy-ethnic-detail
  routing change including the unaffected-plain-garment control case). No existing test needed to
  change; the full pre-existing suite (126 tests) still passes unmodified.
- `next build`: succeeds, all routes compile.
- Runtime smoke: landing 200, `/design` 200, `/login` 200, `/app/new` 307 (auth redirect, correct),
  `/api/estimate` 401 (auth-gated, correct, and critically: no 500, confirming every new import
  across `route.ts`/`plan.ts`/`quality.ts`/`gate.ts`/`schema.ts`/`run.ts` resolves cleanly at
  runtime, not just under `tsc`). No errors in the server log.
- `quoted == charged` re-verified: every routing change (Hero-default, heavy-ethnic-detail) flows
  through the single `planNeed`/`planCredits` brain shared by `/api/estimate` and the real run;
  nothing bypasses it.

## Anything that still needs a live test
1. **The still upscaler slug** — capability fully built and wired, feature-flagged off
   (`DRAPE_UPSCALE_SLUG` unset). Needs a live pass to pick and verify a real fal upscaler slug and
   its field names, then set the env var.
2. **GPT Image 2's native resolution/quality field names** — the resolution floor was deliberately
   not extended to `image/edit` without verification, to avoid regressing the masked-edit path.
3. **FASHN vs Nano Banana Pro on heavy ethnic detail** — the routing change picked the audit's
   own reasoned "safer default"; an actual side-by-side on a zari/chikankari piece would confirm or
   let it be relaxed back to try-on for some sub-types.
4. **The exact visual strength of the `strength` parameter** — confirmed the field is *accepted*
   without error; its visual effect at different values was not isolated in a dedicated comparison.
