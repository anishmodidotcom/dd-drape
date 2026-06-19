# Oviya Studio — Phase 2 (The Studio workspace)

The 5-step wizard is replaced by one cinematic Studio workspace: a persistent control panel on the
left, a central canvas on the right, and a "Shoot" action bar. Built entirely on the existing
ShotSpec seam. The generation engine, director (Analyze/Compose/Route), fidelity gate, credit
ledger, RLS, upload validation, India-first taxonomy, and draft persistence are untouched.

## Against every numbered requirement
1. **One screen, no page-hopping.** `src/components/Studio.tsx` is a single screen. After "Shoot"
   the result renders in the same canvas via an embedded `ResultView` (new `onJob`/`onReset`
   callbacks keep regenerate and video in-place instead of navigating). The composer panel stays
   mounted, so you can tweak and reshoot without losing context.
2. **Product analysis visible and confirmable.** A new `POST /api/analyze` runs the moment a
   product is uploaded, reusing the same cached `getOrAnalyzeProduct` the engine uses (no double
   charge, no divergence). The panel shows "We see <colour>, <fabric>, <sub-type>" with confirmable
   category and sub-type chips you can change.
3. **Smart defaults, one-click Shoot.** Analyze pre-selects the detected category, a matched
   sub-type, and a strong default Editorial for that category, so the action bar is immediately
   priced and one click shoots.
4. **Guided and free coexist in shared state.** Picking an Editorial sets the look; "Fine-tune this
   look" seeds the advanced controls *from* that look (guided work is never discarded). A single
   `spec` memo is the one source of truth for both modes.
5. **Contextual controls morph.** Posing is filtered by product category (a shirt never offers an
   earring pose). When a muse is cast, the model identity controls (casting look, body, who,
   makeup, hair) disappear because the muse anchors them. Jewellery shows the honest hero-detail
   note.
6. **Every control is a visual gallery with a describe-your-own escape hatch; no native dropdowns.**
   New `ui/GalleryPicker.tsx` renders thumbnail tiles plus a "Describe" tile that accepts a typed
   value the engine still honours. Used for posing, set, light, makeup, hair, mood, and casting
   look. Framing, body, who, format, and quality are tile rows. The old native-feeling selects are
   gone from the flow.
7. **Persistent muse / reference slot.** The Casting board lists your saved muses and persists the
   selection across the session (draft v3). A separate Mood reference slot persists an uploaded
   vibe image.
8. **Narrated cinematic shoot loader on image shoots.** The embedded `ResultView` shows
   `LoadingStudio` (the staged "On set" loader) while the job is queued or running, for stills as
   well as video.
9. **Result renders at real non-zero pixel dimensions with a working draggable before/after.**
   Proven live with a headless Chromium probe of the exact result `BeforeAfter`: container
   **560 x 747 px**, both images decoded (naturalWidth **896 x 1200**), each image painting at
   558 x 745 px, and the drag handle moving the reveal from 50% to 20% on interaction. (The
   temporary probe route and script were removed after the gate; puppeteer is not a committed
   dependency.)
10. **Video stays Beta and honest.** "Bring it to life" carries a Beta chip and honest copy: you
    shoot the still first, then create the clip from it with the product locked as the first frame.
11. **Built on the ShotSpec seam.** Only additions are `/api/analyze` (reuses the existing analysis
    cache) and UI. No change to the generation core.
12. **Action bar "Shoot · N credits".** Live estimate via `/api/estimate` using the same
    `planRoute` the real generation uses, so the quoted cost equals the charged cost. The bar shows
    the readiness tier and the credit cost on the button.

Also: no em dashes and no vendor/model names in any user-facing copy. The download filename was
rebranded `oviya-<id>` (a Phase 1 miss caught here).

## Gate
- `tsc --noEmit`: clean
- `vitest run`: 90 passed, 15 live-only skipped
- `next build`: succeeds
- Runtime: landing 200, `/app/new` 307 (auth), `/login` 200, no compile errors; before/after render
  proof passed.
