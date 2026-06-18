# Drape Codebase Audit (read-only)

Date: 2026-06-18. Branch: `claude/eager-dirac-7w9psr`. Method: static read of the full repo (no
code changes, no generations, no fal/Claude calls). Where behavior cannot be confirmed without
running it live, it is marked **unverified**.

Bottom line up front: the **engine is genuinely strong** (reference-locked Analyze→Compose→Route,
fidelity gate, atomic idempotent ledger, RLS everywhere). The **video pipeline is broken by a
three-way slug/field mismatch**. There are **two dead/ungated endpoints**, **orphaned generated
thumbnail assets and an unbuilt makeup/hair gallery**, an **estimate-vs-actual routing drift**, and
the **orphan-queued-job on insufficient credits** is still present. Details below.

---

## 1. Feature inventory

Legend: **Working** / **Partial** / **Broken/Dead** / **Unverified**.

### Auth — Working (email confirmation Unverified)
- Signup, login, sign-out: `src/components/AuthForm.tsx`, `SignOutButton.tsx`, routes
  `src/app/(auth)/login/page.tsx`, `signup/page.tsx`. Email/password via Supabase
  (`src/lib/supabase/client.ts`). Signup has confirm-password, show-password, inline validation,
  Terms/Privacy consent.
- Session redirects: `/login` and `/signup` redirect to `/app/new` when authenticated; `/app/*` is
  guarded by `middleware.ts` (redirect to `/login`) and re-checked in `src/app/app/layout.tsx`.
- **Email confirmation**: `AuthForm` handles the "no session after signUp" case by showing "check
  your email". Whether confirmation is actually ON in the Supabase project is **unverified** (a
  dashboard setting, not in code). If ON, new users cannot enter the app until they confirm; if OFF,
  they enter immediately. Needs a live check.
- Confidence: high on code paths; the email-confirm UX depends on project config.

### Generation wizard — Working (see §5 for step-by-step)
- `src/components/NewShotWizard.tsx` (5 steps) + `src/app/app/new/page.tsx`. Drives `/api/shots`.
- Draft persistence to `localStorage` ("drape-draft-v2"), pinned product thumbnail, clickable
  stepper, staged "studio" loader shown while the (synchronous) image generation is in flight.
- Confidence: high.

### Analyze → Compose → Route engine (Claude director) — Working
- `src/lib/director/` (`index.ts` orchestrates `analyze.ts` → `compose.ts` → `route.ts`) with a
  deterministic fallback (`fallback.ts`) when `ANTHROPIC_API_KEY` is unset or a Claude call throws.
- Forced tool-use JSON, images-before-text, prompt caching on the big system prompts
  (`prompts.ts`). Model `claude-opus-4-8`.
- Reached only via `/api/shots` → `runShot` → `directShot`. **Not** reached via `/api/jobs/submit`
  (see §2, §6).
- Confidence: high (proven live in prior passes).

### Fidelity gate — Working on the main path; fail-open; conditional
- `src/lib/director/gate.ts` (`checkFidelity`, Claude vision). Wired in `src/lib/engine/run.ts`
  (sync image completion) and surfaced as `FIDELITY_FAIL:` → human reason in `/api/jobs/[id]`.
- **Conditions**: only runs when `input.fidelityGate` is set (only `runShot` sets it), `directorEnabled()`
  is true (ANTHROPIC key present), and the need is not video. On gate error it **fails open**
  (ships the generation). So: no gate if the key is missing, and no gate on `/api/jobs/submit`.
- Confidence: high on the wiring; the fail-open + key-gating are deliberate but are real coverage
  gaps (see §6, §7).

### Model routing (capability → fal slug) — Working for images, **Broken for video**
- `src/lib/engine/registry.ts`. Image/try-on needs route to verified reference-capable `/edit`
  slugs; `assertReferenceCapable()` guard present. Reachable from UI: `image/standard`,
  `image/hero`, `image/edit`, `tryon` (tryon only when a saved model is selected).
- `bg-remove` and `upscale/video` are in the registry but **not reachable from any UI control**
  (no background-remove or upscale button). Effectively latent capabilities.
- **Video slugs are inconsistent across three files** — see §4. This breaks video.
- Confidence: high.

### Models studio — Working
- Create + 4-angle generation + save + reuse: `src/lib/models/` (`generate.ts`, `prompt.ts`,
  `schema.ts`, `data.ts`), `src/app/api/models/route.ts`, `src/app/app/models/page.tsx`,
  `src/components/CreateModelPanel.tsx`. Reuse flows through `spec.modelImagePaths` → `directShot`
  → `tryon`. Proven live in a prior pass.
- Confidence: high.

### Makeup / hair galleries — **Partial / specced-but-not-built as galleries**
- Makeup and hair are plain `CustomSelect` dropdowns in the wizard Advanced panel — not browsable
  thumbnail galleries.
- `scripts/gen-presets.mjs` generated and stored **makeup (3) and hair (3)** thumbnails in the
  `drape-presets` bucket, and the manifest (`src/lib/shot/preset-thumbnails.json`) contains them,
  but the UI only reads `thumbUrl("presets")` and `thumbUrl("poses")`. **The makeup/hair (and
  lighting/sets) thumbnails are orphaned assets.** See §4.
- Confidence: high.

### Presets (Simple) + Advanced controls — Working
- Presets: `src/lib/shot/presets.ts` (6), rendered as `PresetCard` with skeleton→crossfade.
- Advanced panel (`NewShotWizard.AdvancedControls`): shot type, model ethnicity/body/gender,
  makeup, hair, pose (thumbnail gallery, category-filtered), background, lighting, framing, vibe,
  output format, quality, free brief, saved-model picker. All custom-styled selects.
- Confidence: high.

### Video (i2v, motion, worker, reconciler) — **Broken** (multiple causes)
- UI: wizard Step 4 (Beta) + result-screen "Bring it to life". Routes to `/api/jobs/[id]/video`.
- **Broken because** (see §4 for detail): (a) the video falInput uses `image_url` but the registry
  slug (Kling) needs `start_image_url`; (b) the worker submits to a **different** slug
  (`seedance-2.0`) than the registry (`kling v3 pro`); (c) without a deployed worker, a video job
  has no `fal_request_id`, so the UI auto-reconcile treats it as "never started" and refunds. Net:
  video will not complete; at best it auto-refunds.
- Motion prompts (`src/lib/shot/motion.ts`) and `buildMotionPrompt` are correct and category-filtered.
- `worker/stitch.ts` (ffmpeg multi-clip stitch) is **defined but never imported** — dead.
- Confidence: high that it is broken; the exact failure point is **unverified** without a live run
  + a deployed worker.

### Credits ledger — Working (one ordering bug)
- `supabase/migrations/0001` + `0003`; `src/lib/engine/credits.ts`, `ledger.ts`. Reserve/settle/
  refund are idempotent per `(job_id, kind)` (existence check under `FOR UPDATE` + partial unique
  index `drape_credit_txn_job_kind_uniq`). Atomic. Human-readable notes (`finalize.labelFor`,
  `creditLabel`). Credits page sanitizes any legacy codes.
- **Bug**: `runJob` calls `createJob` **before** `reserveCredits`, so an insufficient-credits
  failure leaves an orphan `queued` job row. See §6, §7.
- Confidence: high.

### Output / download / My shots / before-after — Working (preview-refresh gap)
- Result screen `src/components/ResultView.tsx` + `src/app/app/shots/[id]/page.tsx`. Large media
  (B1 fixed), before/after `BeforeAfter.tsx`, blob download, AMBER QC checklist, "Created with AI"
  label toggle, retry affordance.
- My shots `src/app/app/shots/page.tsx` uses `SmartImage` (auto-refresh on 403).
- **Gap**: `ResultView` and `BeforeAfter` render the **raw signed URLs** from `/api/jobs/[id]`, not
  `SmartImage`. The poll refreshes them only while processing; once `done`, a page left open past
  the 1h signed-URL TTL will show a broken result image. See §7.
- Confidence: high.

### Landing page — Working
- `src/app/page.tsx`: session-aware header/CTA, hero, before/after demo, output gallery (public
  `drape-presets` images), how-it-works, credits explainer, FAQ, footer. `/terms`, `/privacy`
  stubs exist.
- Confidence: high.

### Compliance (C2PA + AI label) — Working (shape only)
- `src/lib/shot/provenance.ts` (`buildProvenanceManifest`) written as a sidecar JSON on every
  output in both `run.ts` (sync) and `finalize.ts` (async). Visible "Created with AI" label toggle
  in `ResultView`.
- **Honest caveat**: it is a C2PA-**shaped** JSON manifest, not a cryptographically signed C2PA
  claim embedded in the image. Adequate for disclosure; not tamper-evident.
- Confidence: high.

---

## 2. Route & file map

### Pages
| Route | File | Purpose | State |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Landing (session-aware) | Working |
| `/login`, `/signup` | `src/app/(auth)/*` | Auth; redirect if logged in | Working |
| `/terms`, `/privacy` | `src/app/{terms,privacy}/page.tsx` | Legal stubs | Working |
| `/app` | `src/app/app/page.tsx` | Redirect → `/app/new` | Working |
| `/app/new` | `src/app/app/new/page.tsx` | The wizard | Working |
| `/app/models` | `src/app/app/models/page.tsx` | Models studio | Working |
| `/app/shots` | `src/app/app/shots/page.tsx` | My shots grid | Working |
| `/app/shots/[id]` | `src/app/app/shots/[id]/page.tsx` | Result screen | Working |
| `/app/credits` | `src/app/app/credits/page.tsx` | Ledger view + stub modal | Working |

### API routes
| Route | File | Purpose | State |
|---|---|---|---|
| `POST /api/shots` | `api/shots/route.ts` | Main generation (director + gate) | Working |
| `POST /api/estimate` | `api/estimate/route.ts` | Dry-run cost/tier | Working but **drifts** from actual routing (§4) |
| `POST /api/uploads` | `api/uploads/route.ts` | Validated image upload | Working |
| `GET /api/media` | `api/media/route.ts` | Signed URL for owned object | Working |
| `POST /api/models` | `api/models/route.ts` | Create model | Working |
| `GET /api/jobs/[id]` | `api/jobs/[id]/route.ts` | Job status + signed URLs | Working |
| `POST /api/jobs/[id]/qc` | `.../qc/route.ts` | Approve AMBER | Working |
| `POST /api/jobs/[id]/regenerate` | `.../regenerate/route.ts` | Re-run same spec | Working |
| `POST /api/jobs/[id]/video` | `.../video/route.ts` | Start i2v | **Broken** (field/slug, §4) |
| `POST /api/jobs/[id]/retry` | `.../retry/route.ts` | User reconcile one job | Working |
| `POST /api/jobs/reconcile` | `api/jobs/reconcile/route.ts` | Worker/cron reconcile (WORKER_SHARED_SECRET) | Working |
| `POST /api/jobs/fal-webhook` | `api/jobs/fal-webhook/route.ts` | fal callback (2-layer auth) | Working; **unverified live** (no real delivery captured) |
| `POST /api/jobs/submit` | `api/jobs/submit/route.ts` | Raw need+falInput runner | **Dead + ungated** (§4, §6) |
| `GET /api/health` | `api/health/route.ts` | Liveness | Working |

### Key modules
- **engine**: `registry.ts` (need→slug + guard), `estimator.ts`, `run.ts` (job lifecycle + sync
  gen + fidelity gate), `run-shot.ts` (director glue), `finalize.ts` (async settle, shared by
  webhook + reconciler), `reconcile.ts`, `credits.ts`/`ledger.ts`, `jobs.ts`, `storage.ts`,
  `image-validate.ts`, `fal.ts`, `fal-webhook.ts`, `tier.ts`.
- **director**: `index.ts`, `analyze.ts`, `compose.ts`, `route.ts`, `gate.ts`, `fallback.ts`,
  `products.ts`, `prompts.ts`, `schema.ts`, `client.ts`.
- **shot** (config/domain): `spec.ts`, `subtypes.ts`, `presets.ts`, `formats.ts`, `motion.ts`,
  `qc.ts`, `provenance.ts`, `loading.ts`, `thumbnails.ts`, `compose.ts` (legacy `buildGeneration`,
  only used by `/api/estimate`).
- **models**: `generate.ts`, `prompt.ts`, `schema.ts`, `data.ts`.
- **supabase**: `admin.ts` (service role), `server.ts` (cookie-bound, RLS), `client.ts` (browser),
  `types.ts`.
- **worker**: `worker/index.ts` (poll/claim/submit video + periodic reconcile), `worker/stitch.ts`
  (**dead**).
- **UI**: `NewShotWizard`, `ResultView`, `CreateModelPanel`, `Uploader`, `BeforeAfter`,
  `LoadingStudio`, `SmartImage`, `TierBadge`, `AppNav`, `SignOutButton`, `GetCreditsModal`,
  `ui/{CustomSelect,ThumbTile,Toast}`.

### Dead / orphaned
- `src/app/api/jobs/submit/route.ts` — not referenced anywhere; bypasses director, guard, fidelity
  gate. **Dead and a latent safety hole if discovered.**
- `worker/stitch.ts` `stitchClips` — never imported. **Dead.**
- `src/lib/engine/fal.ts` `submitAsync` and `fetchResult` — never called (the worker uses
  `fal.queue.submit` directly; reconcile uses `getQueueStatus`). **Dead exports.**
- `drape-presets` thumbnails for **lighting(5), sets(4), makeup(3), hair(3)** — generated/stored but
  never read by the UI. **Orphaned assets.**

---

## 3. Specced-but-missing (vs the build prompts)

- **Catalog consistency / per-model training** — intentionally deferred. Correctly absent.
- **Staged "studio" loading on image gens** — **Present.** The wizard renders `LoadingStudio`
  while the synchronous `/api/shots` call is in flight (`NewShotWizard.tsx` step 4 + submitting).
- **Contextual control filtering** — **Present.** `posesForCategory` (`spec.ts`) and
  `motionsForCategory` (`motion.ts`) filter the pose gallery and motion list; tested in
  `__tests__/contextual.test.ts`.
- **Fidelity gate on every hero generation** — **Partial.** Fires on the `/api/shots` image path
  only, and only when `ANTHROPIC_API_KEY` is set; fail-open on error; never on `/api/jobs/submit`.
  Not "every generation" in the strict sense (video has none by design; the raw submit endpoint has
  none).
- **Reconciler running in production** — **Conditional.** Code exists and runs from two places (the
  worker every ~60s, and the UI poll calling `/api/jobs/[id]/retry`). Whether the Railway **worker
  is actually deployed** is **unverified** and matters a lot, because the worker is the only thing
  that submits video jobs to fal at all.
- **Signed-URL refresh** — **Partial.** `SmartImage` refreshes on error and is used in My shots and
  Models. The **result screen does not use it** (raw URLs), so a long-open result page can break.
- **RLS on every `drape_` table** — **Present.** `drape_credit_balances`, `drape_credit_transactions`,
  `drape_jobs`, `drape_products`, `drape_models` all `enable row level security` with a
  `select_own` policy and **no** client insert/update/delete policy (service-role-only writes).
- **Makeup/hair galleries (Phase C/F spec)** — **Missing as galleries** (dropdowns instead;
  thumbnails generated but unused).
- **ffmpeg multi-clip stitching (Phase 3 spec)** — **Present but dead** (`worker/stitch.ts` unwired).
- **bg-remove / upscale capabilities** — in the registry, **no UI** to invoke them.
- **Output format presets → exact dimensions** — formats carry width/height and an `image_size` is
  passed to the model, but the models treat it as a hint (an earlier QA run saw fal return a larger
  size than requested). Not a guaranteed crop.

---

## 4. Drift & duplication

1. **Video slug/field three-way mismatch (MAJOR, breaks video).**
   - `registry.ts` `video/standard` → `fal-ai/kling-video/v3/pro/image-to-video`, refShape
     `start_image` (needs `start_image_url`).
   - `api/jobs/[id]/video/route.ts` builds `falInput: { image_url, prompt, duration }` — wrong field
     name for Kling (and it bypasses `route()` so `refShape` is never applied).
   - `worker/index.ts` `SLUGS["video/standard"] = "fal-ai/bytedance/seedance-2.0/image-to-video"` —
     a **different** model than the registry, priced differently (estimator uses Kling's
     11.2¢/s; Seedance is ~30¢/s). The Seedance slug also did not resolve a schema in earlier checks.
   - Result: the worker submits the wrong falInput shape to a different-than-priced slug. Video does
     not complete.
2. **Estimate vs actual routing drift (MODERATE).** `/api/estimate` uses the **legacy**
   `buildGeneration` (`shot/compose.ts`), which has no saved-model awareness and never returns
   `tryon`. The real path uses `directShot`/`fallbackRoute`, which **does** pick `tryon` (8 credits)
   when a saved model is selected. So with a saved model, the review screen shows
   `image/hero` (15 credits) while the actual charge is `tryon` (8). Two routing brains.
3. **Two generation entrypoints.** `/api/shots` (director, guard, gate) vs `/api/jobs/submit` (raw,
   none of those). The latter is dead but still deployed.
4. **Two reconcile triggers.** Worker (`/api/jobs/reconcile`, bulk) + UI poll (`/api/jobs/[id]/retry`,
   single). Both are fine and idempotent, but it is two code paths doing overlapping work.
5. **Orphaned thumbnail groups.** `gen-presets.mjs` produces 6 groups; the UI consumes 2.
6. **Dead exports**: `fal.submitAsync`, `fal.fetchResult`, `worker/stitch.stitchClips`.
7. **Legacy `buildGeneration`** still carries its own `image_size`/`aspect_ratio` falInput assembly
   that is never used for real generation (only its `need`/`tier` are read by estimate). Mild
   confusion risk.
8. **Docs drift**: `credits.ts` comment points to `0001_drape_init.sql` for the function signature,
   but the idempotent version lives in `0003_drape_money_safety.sql`. Cosmetic.

---

## 5. The interaction model (what the rebuild replaces)

The studio is a 5-step linear wizard in one client component (`NewShotWizard.tsx`), single route
`/app/new`. State is local React state, mirrored to `localStorage` ("drape-draft-v2") on every
change and cleared on successful submit. A `maxStep` tracks how far the user has reached so the
stepper can jump back to visited steps.

State held (the logic the rebuild MUST preserve under any new UI):
- `products: UploadedItem[]` (paths + signed preview URLs), `vibeRef` (optional reference).
- `category`, `subType`.
- `mode: "presets" | "advanced"`, `presetId`, `adv: Partial<ShotSpec>` (the advanced control bag),
  `shotTypeOverride`.
- `modelId` (selected saved model) and `freeBrief`.
- `videoOn`, `motionPreset`, `seconds`.

Steps:
1. **Upload** — `Uploader` posts to `/api/uploads` (server-side magic-byte sniff, ≥1024px floor,
   EXIF strip), stores under `uploads/<uid>/`, returns `{path,url}`. Gate: at least one product.
2. **What is it** — category tiles + sub-type chips (`subtypes.ts`). Sub-type drives tiering and
   contextual filtering.
3. **Choose your shot** — Presets (filtered by category) OR Advanced (model/makeup/hair/pose
   gallery/background/lighting/framing/vibe/format/quality + saved-model picker + free brief).
   "Suggest a look" enriches the Advanced bag (does not bounce to presets).
4. **Video (Beta)** — toggle + motion (category-filtered) + clip length. Note: this only sets intent
   for the still; video is generated later from the approved still.
5. **Review** — calls `/api/estimate` for cost + tier badge + RED-block warning, then `submit()`
   POSTs the assembled `spec` to `/api/shots` and navigates to `/app/shots/[id]`.

The single source of truth handed to the backend is the assembled `ShotSpec` (`spec.ts`): the
rebuild can change the entire UI as long as it still produces a valid `ShotSpec` and calls
`/api/estimate` and `/api/shots`. Everything below the spec (director, routing, gate, ledger) is
UI-agnostic and should be preserved unchanged.

---

## 6. Engine & data integrity (code-side)

- **Reference image always attached to a reference-capable slug?** On the `/api/shots` path: **yes,
  enforced in code.** `directShot` → `route()` (`director/route.ts`) calls `assertReferenceCapable(need)`
  (throws on any `textToImage` slug — and all current registry slugs are `textToImage: false`),
  attaches the product to the correct field per `refShape`, then `assertImageAttached()` verifies a
  non-empty reference field exists in the built body before returning. Every registry need passes
  the guard. This is the v1-bug fix and it is correct **for this path**.
  - **Hole**: `/api/jobs/submit` calls `runJob` directly with a caller-supplied `falInput` and need.
    It performs **no** guard, no director, no `assertImageAttached`, no fidelity gate. It is dead in
    the UI but live on the server. If anything ever calls it, the fidelity guarantees do not hold.
- **Fidelity gate wired into every completion path?** **No, by design and by gap.** It is wired into
  the **sync image** completion in `run.ts` (set only by `runShot`). Video (async, `finalize.ts`)
  has no gate (gate is image-only). `/api/jobs/submit` has none. And the gate is skipped entirely
  when `ANTHROPIC_API_KEY` is absent, and **fails open** on any gate error. So "fires on every hero
  generation" is true only for `/api/shots` with the key set and the gate call succeeding.
- **Reserve/settle/refund idempotent and atomic?** **Yes.** `drape_debit_credits` (0003) does the
  existence check and the balance write under a single `FOR UPDATE` lock; a partial unique index
  enforces one row per `(job_id, kind)`. `finalizeSuccess/Failure` early-return on already-settled
  jobs. Verified live in prior passes (double-refund → single refund).
- **Where could the engine regress to ignoring the reference image?**
  1. Any new call site that uses `runJob`/`/api/jobs/submit` directly instead of `runShot` skips the
     guard + gate. Recommend deleting `/api/jobs/submit` or routing it through the guard.
  2. The **video path** already bypasses `route()` and hand-builds falInput — it does attach the
     still (`image_url`), but with the wrong field name, and there is no `assertReferenceCapable`/
     `assertImageAttached` on it. It is the clearest existing "reference not correctly attached"
     regression.
  3. If a future registry entry is added with `textToImage: true` (or `refShape: "none"`) and routed
     to, the guard throws — good — but only on the `route()` path.
- **Ledger ordering bug**: `runJob` creates the job row before reserving, so insufficient credits
  leaves a stranded `queued` job (cosmetic clutter + a phantom "Processing" card the user can only
  clear via retry, which then fails+refunds zero).

---

## 7. Tech debt & risk register (prioritized)

| # | Severity | Risk | Where |
|---|---|---|---|
| 1 | **High** | Video is broken end-to-end (slug/field/worker three-way mismatch). Users can start a video, it never completes; best case auto-refund. | `registry.ts`, `api/jobs/[id]/video/route.ts`, `worker/index.ts` |
| 2 | **High** | Video also cannot run at all unless the Railway worker is deployed (it is the only submitter). Deployment status unverified. | `worker/index.ts` |
| 3 | **High** | `/api/jobs/submit` is a live, authenticated endpoint that bypasses the fidelity guard + gate. Dead in UI, but a real safety hole. | `api/jobs/submit/route.ts` |
| 4 | Medium | Estimate vs actual routing drift: review screen can quote the wrong credits/tier (saved-model → tryon). Erodes trust in the credit display. | `api/estimate/route.ts` vs `director/fallback.ts` |
| 5 | Medium | Orphan `queued` job on insufficient credits (reserve after createJob). Clutters My shots, shows a stuck "Processing". | `run.ts` (createJob before reserve) |
| 6 | Medium | Result screen previews use raw 1h signed URLs (not `SmartImage`); a long-open result page breaks. | `ResultView.tsx`, `BeforeAfter.tsx` |
| 7 | Medium | Fidelity gate is fail-open and key-gated; a Claude outage or a missing key silently ships ungated output. No programmatic ΔE backstop. | `run.ts`, `director/gate.ts` |
| 8 | Low | fal webhook signature scheme is implemented to spec but **never verified against a real delivery**; a wrong assumption would 401 all real video callbacks. | `fal-webhook.ts` |
| 9 | Low | Dead code (`stitch.ts`, `fal.submitAsync/fetchResult`, orphan thumbnails) will confuse the rebuild and rot. | various |
| 10 | Low | EXIF strip is JPEG-only; PNG/WEBP metadata retained. | `image-validate.ts` |
| 11 | Low | `storeUpload` still lists `video/mp4`/`quicktime` in its allowed set though the route blocks them. | `storage.ts` |
| 12 | Low | Output dimensions are a hint, not enforced; "format" may not crop exactly. | `compose.ts`/models |
| 13 | Low | Cleanup of test users intermittently blocked by a CGE FK (left an orphan balance row once). Harness hygiene, not product. | live test scripts |

---

## 8. What is genuinely good (preserve through the rebuild)

- **The Analyze→Compose→Route director** with deterministic fallback. The single most valuable
  asset. Proven live (white kurta stayed a white kurta). `src/lib/director/*`.
- **The text-to-image guard + `assertImageAttached`** on the `/api/shots` path. The v1 bug cannot
  recur here. `registry.ts`, `director/route.ts`.
- **The fidelity gate** as a trust backbone (keep it; make it cover more paths, not less).
- **The credits ledger**: atomic, idempotent, append-only, human-readable notes, RLS-scoped reads,
  service-role-only writes. `migrations 0001/0003`, `credits.ts`, `ledger.ts`.
- **RLS from birth on every `drape_` table** with no permissive client write policy. Stricter than
  the brief asked.
- **Upload validation**: magic-byte sniff, resolution floor with friendly coaching, EXIF strip.
  `image-validate.ts`.
- **The India-first taxonomy**: sub-types, ethnicities, lighting (Diya Warm Tungsten), makeup
  (Heavy Kohl Bridal), vibes, preset copy. `subtypes.ts`, `spec.ts`, `presets.ts`. A real
  differentiator.
- **Draft persistence**, **the "ON SET" staged loader**, **the Quick-review checklist**, **the
  before/after reveal**, the **honest Models caveat**, and the **signed-URL `SmartImage`** primitive
  (just apply it on the result screen too).
- **The `ShotSpec` seam**: a clean contract between UI and engine that lets the studio be rebuilt
  without touching generation logic.

---

## Verification status

- Static/code claims: high confidence (read directly).
- **Unverified, needs a live test**: email-confirmation UX (project config); fal webhook signature
  against a real delivery; whether the Railway worker is deployed; the exact video failure point;
  B1 pixel rendering in a real browser (layout fix is correct in code).
- No live calls were made for this audit.

---

## Addendum: audit-fix pass (applied)

The following defects from this audit were fixed in a dedicated pass (no UI redesign; engine/gate/
ledger/RLS preserved):

1. **`/api/jobs/submit` removed** — the dead, ungated generation endpoint is deleted.
2. **Video aligned + gated** — registry slug, route field, and worker slug now all agree on Kling
   v3 pro i2v with `start_image_url`. Video is behind `DRAPE_VIDEO_ENABLED` (default OFF); when off,
   `/api/jobs/[id]/video` fails fast and clean (503) **before** any reserve/charge. When a video job
   does exist with no worker, the UI auto-reconcile fails+refunds it. `worker/stitch.ts` is marked
   `TODO(final-pass video rebuild)` (dormant, not dead). Intended wiring is documented in
   `src/lib/engine/features.ts`.
3. **One routing brain** — `/api/estimate` and the director both route via `src/lib/shot/plan.ts`
   (`planRoute`/`planNeed`). The director overrides Claude's `model_route` with `planNeed`, so the
   quoted credits always equal the charged credits (the saved-model 15-vs-8 drift is gone). Legacy
   `buildGeneration` deleted.
4. **Fidelity gate is deliberate** — runs on every product image completion; records
   `verified | unverified | failed` on the job. A gate that cannot run (no key / error) is logged
   and the output is flagged **unverified** in the UI rather than implied-verified. Confirmed
   non-match still refunds + fails.
5. **Result screen uses signed-URL refresh** — `ResultView` and `BeforeAfter` render from storage
   paths via `SmartImage` / the smart `BeforeAfter`; download resolves a fresh signed URL at click
   time. Previews no longer break on expiry.
6. **No orphan jobs** — `runJob` reserves credits FIRST (against a pre-generated id), then creates
   the job row; an insufficient-credits failure leaves no dangling `queued` job.
7. **Dead code removed** — `fal.submitAsync`/`fetchResult` deleted; `buildGeneration` deleted;
   `stitch.ts` marked for the final-pass rebuild. (Makeup/hair/lighting/set thumbnails intentionally
   kept for the redesign galleries.)
8. **Worker heartbeat** — the worker logs a heartbeat every ~5 min so its loop can be verified in
   prod. `nixpacks.toml` start command is `npm run worker` (if Railway is running `next start`, that
   is a Railway service-config issue, not code). Note: `qc_status = pending` is **correct** for
   AMBER jobs awaiting review; it advances to `approved` on user approval. It is not a stuck state.

Still unverified (need live): video end-to-end once enabled + worker deployed; fal webhook signature
against a real delivery; whether the Railway service actually runs `npm run worker`.
