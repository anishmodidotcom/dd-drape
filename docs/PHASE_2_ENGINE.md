# Oviya v4 - Phase 2: the engine / intelligence rebuild

The brain Phase 3 will skin. Built on the existing director (Analyze -> Compose -> Route), fidelity
gate, credit ledger, RLS, taxonomy, and draft persistence, none regressed. Internal `drape_`
namespace, buckets, env, repo unchanged. Reserve at submit; quoted cost = charged cost on every new
path. Gemini stays brand/preset-only; fal is the live product engine.

## 1. Model-reuse collage bug - root cause + fix
**Root cause.** When a saved model was used, the model-identity image was concatenated into the edit
model's `image_urls` array (`route.ts`), and the prompt did not forcefully assign a role to each
reference or forbid a collage. Multi-reference edit models (Nano Banana Pro) then rendered BOTH
reference photos side by side instead of composing one subject wearing the product.
**Fix (two parts).**
- Prompt: a single-subject lock (`ANTI_COLLAGE`) + per-image role naming (`referenceRolesClause` in
  `shot/compose.ts`), appended whenever an identity or >1 reference is attached, plus anti-collage
  terms in the negative prompt and the compose system prompt. The identity image is declared an
  identity CONDITION ("the output person must have this exact face... do not show this photo"), never
  a panel to depict.
- Routing: single apparel on-model with one identity still uses FASHN try-on (structurally clean);
  everything else (jewellery, multi-product) uses the multi-reference edit path with the lock.
Verified by unit tests (the prompt contains "model identity", "no collage", "do not show this photo").

## 2. Multi-product
- `referenceImagePaths` now means N DISTINCT articles (cap `MAX_PRODUCTS=5`).
- The director analyzes EACH product (`run-shot.ts` loops `getOrAnalyzeProduct`; `directShot` returns
  `analyses[]`) and composes them onto ONE model, each preserved, with per-image role naming.
- The fidelity gate checks EVERY product against the output (`run.ts` loops; any drift fails+refunds
  the whole shot).
- Routing: multi-product never uses single-garment try-on; it routes to the multi-reference hero
  edit (up to 14 refs). One output image, so cost is unchanged (quoted == charged).

## 3. Auto-identify, hide the pills
Identification already runs on upload via `/api/analyze`. The Studio now shows the confirmable read
("We see a teal chikankari cotton kurta") and HIDES the manual category/sub-type pills behind an
optional "Not quite? Tell us what it is" override (auto-opened only if identification is unavailable,
so the user is never stuck). Engine exposes the analysis + the override path; Phase 3 builds the full
UI.

## 4. Free text everywhere
`ShotSpec.freeBrief` (global) and `ShotSpec.freeText` (per-control map) are first-class. The director
serializes them as AUTHORITATIVE intent that may override structured selections (`specToIntentText`
+ the compose system prompt). Per-control free text is exposed at the spec level for Phase 3 to wire
"describe your own" on every control.

## 5. Multiple outputs (a directed shoot)
`outputCount` (cap `MAX_OUTPUTS=6`) + `variateModel`. `planShootFrames` (pure, tested) turns one base
spec into N art-directed frames that vary framing, pose, angle and crop like a photographer working a
look (establish / move / detail), staying category-valid. `runShoot` checks affordability for N
upfront (`planCredits`, the single cost source shared with `/api/estimate`), then runs each frame as
its own reserve/settle/refund grouped under the first frame via `parent_job_id`: reserve for N,
settle per delivered, refund failures. Quoted == charged (sum of per-frame routes).

## 6. Replace (image + video)
- New needs `image/replace` (Nano Banana Pro edit) and `video/replace` (Kling i2v), both
  reference-capable. The source becomes Image 1 (kept), products follow (`route.ts` ordering +
  `replaceSource`), and the prompt keeps the source scene while swapping only the product(s).
- Image replace: sync, fidelity-gated on the product(s). API: `POST /api/shots` with
  `spec.replace.sourceImagePath`.
- Video replace (`runReplaceVideo`): swap the product into the source frame (sync image/replace),
  then enqueue an i2v anchored to that swapped still so the product stays locked across frames. API:
  `spec.replace.sourceVideoPath`.

## 7. Model system expansion + upload-your-own
- Casting taxonomy expanded international-first: ~45 ethnicities/regional looks, an independent skin
  tone axis (9), broader bodies (10) and age ranges (6), more genders. The prompt humanizes any new
  id automatically and folds in `skinTone` + free-text `describe`.
- Upload-your-own model: `POST /api/models { uploadedPaths }` -> `createUploadedModel` saves the
  user's own person/face/body reference to `drape_models` (no credits), reusable exactly like a
  generated model, and it composes cleanly thanks to the item-1 fix.

## 8. Save product to collection
Migration `0005_drape_saved_products.sql` adds `saved` + `name` to `drape_products`. `saveProduct` on
a shot auto-saves the input(s); `POST /api/products` saves explicitly and `GET /api/products` lists
saved products for reuse. (Requires the migration applied; see manual steps.)

## 9. JSON upload error - root cause + fix
**Root cause.** The platform caps serverless request bodies (~4.5 MB) and returns a plain-text
"Request Entity Too Large" on bigger uploads; the client blindly `JSON.parse`'d that body, yielding
`unexpected token 'r', "request en"...`.
**Fix.** (a) `parseJsonSafe` (`lib/http.ts`) reads the body once and never throws, returning a clean
human message keyed off status (413 -> a size message). Wired into the Uploader, Studio analyze, and
Studio shoot. (b) `maybeDownscale` (`lib/imageDownscale.ts`) downscales large images in the browser
to ~3.6 MB before upload, so the 413 no longer occurs at all. Tested.

## 10. Tiny-image hard block removed
`validateImageUpload` now ACCEPTS small images with a non-blocking `warning` ("This image is small,
results may be softer") instead of rejecting them; genuinely invalid files (non-image/corrupt) are
still rejected. The Studio shows the advisory dismissibly and never blocks. Tested.

## 11. Caching
`lib/mediaCache.ts` caches the resolved signed URL per storage path for ~50 min and dedupes
concurrent resolves. `SmartImage` and `BeforeAfter` use it, so reopening a gallery re-resolves
nothing AND, because the URL is now stable, the browser HTTP-caches the image bytes too (previously
impossible since each signed URL was unique). This directly fixes "models and previous-shot images
reload from scratch every time." On an expired-link image error the entry is invalidated and re-minted.

## 12. Engine / intelligence review
- The director handles single product, multi-product, free-text-driven, multi-output shoots, replace
  (image + video), and saved/uploaded identities without regressing fidelity. One routing brain
  (`planNeed`) decides every cost-bearing route; `planCredits` is the single cost source for
  `/api/estimate` and the runners, so quoted == charged on all new paths.
- The fidelity gate fires on every still path and checks ALL products (multi-product + replace).
- No path can silently drop a product reference (the router throws if the product image is missing
  from the built body) or composite a collage (the single-subject lock + negatives).
- Credits reserve/settle/refund correctly for multi-output (per-frame) and video (async settle on the
  worker webhook).

### Video intelligence
The still-from-video and video-from-still paths route to the Kling i2v slug with `start_image_url`,
the field the registry, the `/api/jobs/[id]/video` route, and the worker all agree on (the v3
alignment held; `video/replace` added to all three). Credits handled; video stays Beta and fails
cleanly with an auto-refund when disabled.

### Capability gaps (documented for the advanced-controls phase)
- **Frame-exact video product-swap:** there is no production video-to-video product-swap slug, so
  `video/replace` re-synthesizes motion via i2v from the swapped still rather than lifting the
  source's exact motion frame-by-frame. The product stays locked; the motion is a faithful
  re-creation, not a copy.
- **Multi-angle of the SAME product:** `referenceImagePaths` currently models distinct articles; a
  dedicated "these N images are the same product from different angles" mode is not yet separated
  from multi-product. Today, extra angles of one product can be passed and the director preserves
  them, but it is not a first-class mode.
- **Per-product fidelity verdicts:** the gate fails the whole shot on the first product that drifts;
  it does not yet return a per-product pass/fail breakdown to the UI.

## The single runtime dependency
Video (including video/replace) needs the Railway worker running `npm run worker` (Anish's manual
step). The full logic is built and correct; until the worker runs, video jobs queue and, when video
is disabled, fail cleanly with an auto-refund (no charge, no dead end).

## Manual steps for Anish
1. Apply migration `supabase/migrations/0005_drape_saved_products.sql` (adds `saved` + `name` to
   `drape_products`) before using the save-product collection (item 8).
2. Run the Railway worker (`npm run worker`) for video (items 6/12 + video intelligence).
3. Top up the Gemini key (carried over from Phase 1) only to regenerate brand assets; not needed for
   the engine.

## Gate
- `tsc --noEmit`: clean
- `vitest run`: 110 passed, 15 live-only skipped (20 new engine tests: identity fix, multi-product,
  shoot variation, new-path routing/cost, JSON-error handling, tiny-image acceptance)
- `next build`: succeeds (`/api/products` added)
- runtime smoke: app routes serve; every API returns valid JSON (no parse crashes); no runtime errors.
