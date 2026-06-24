# Oviya v4 - Phase 3: the product surface

The entire product surface rebuilt on the Phase 1 dual-mode brand/tokens/primitives and the Phase 2
engine. Top-bar shell (the left rail is gone) with a theme toggle and a mobile bottom tab bar.
Terminology fixed everywhere: "model" not "muse", "My Shots" not "Contact Sheet", no "calling
action". No native dropdowns, no vendor names, no em dashes. Dual-mode throughout.

## 3A. The Studio workspace (`src/components/Studio.tsx`)
1. Left rail killed; the studio is full page (`.studio3`).
2. Controls live on the RIGHT (a scrolling rail of accordion panels) and a top action bar.
3. The canvas is the hero (left, full bleed): empty invitation, product preview, the result, or the
   multi-output set.
4. Basic vs Advanced are two states of the SAME workspace (a segmented toggle), shared state, no
   reset on switch. Basic shows a curated few panels and a near-one-click shoot; Advanced reveals the
   full set.
5. Auto-identify with the read shown ("We see a teal chikankari cotton kurta"); the manual category
   pills are hidden behind "Not quite? Tell us what it is" (auto-opened only if identification is
   unavailable).
6. Action bar: the free-brief input (first-class), selection chips (products, model, look, frames,
   readiness), the primary "Shoot, N credits" CTA, a Basic/Advanced toggle and a Draft/Hero quality
   toggle (default Draft/standard).
7. The atelier-process loader on every wait (the old "set is ready" image and "calling action" text
   are gone; `ResultView` now uses `AtelierLoader` too).
8. Result + before/after render large and correct (the proven `BeforeAfter`, non-zero dimensions,
   signed-URL auto-refresh via the cache), fidelity status surfaced, per-result actions (download,
   make a variation, animate to video, use in replace, reshoot, how-this-was-made).
9. Multi-output sets render as a coherent shoot in the canvas (`ShootSet`), each frame actionable.
10. Multi-product: add up to 5 product articles in the rail, each identified, shot together.
11. Save-to-collection: an auto-save toggle on upload (on by default) plus the engine's saveProduct.
12. The "Can't find the control you want?" escape hatch sits in the control set.
13. Mobile: the rail collapses; a "Direct" button opens it as a bottom Sheet with the Shoot CTA; the
    bottom tab bar is thumb-reachable.
14. Premium dual-mode on the Phase 1 system (oxblood accent, glass on overlays, film grain).

## 3B. Advanced controls (`src/components/studio/Controls.tsx`)
Every control is a visual gallery (thumbnail + label, never blank) with a describe-your-own escape
hatch, wired to the engine. No native dropdowns.
- Casting: the expanded model system (~45 ethnicities, skin tone, body, age, gender, expression),
  the saved-models library, and upload-your-own-model (no credits).
- Posing (contextual to product type), Makeup, Hair (thumbnail galleries).
- Location/Set (presets + "describe your location"), Light.
- Camera & lens (focal feel, angle, depth of field).
- Framing/crop, Mood & colour grade.
- Export size + format (the deduped aspect set).
- Looks/Editorials (the Phase 1 thumbnails) that enrich Advanced without wiping it.
- Output count + same/different model.
- Fidelity latitude slider (creative latitude to preserve product), with the product pinned in the
  before/after.
The lens/angle/grade/expression/latitude/location controls route through the engine's authoritative
per-control free-text channel (Phase 2 item 4), so the director reasons over them directly.

## 3C. The four tabs + the shot page
- Studio/New: 3A.
- Models (`ModelsGallery`): premium library grid; clicking a model opens a detail showing ALL angle
  photos (fixes the could-not-open / 2-photo bug); the guided 49-credit create form; upload-your-own;
  "Use in the studio".
- My Shots (`ShotsGallery`): heading fixed to "My Shots"; filter (All/Images/Video), sort
  (Newest/Oldest), a Select mode with bulk download, per-shot open; a premium lookbook grid; uses the
  Phase 2 media cache so it does not reload from scratch.
- Credits: restyled to the brand (display balance hero, human-readable ledger).
- The shot page (`ResultView` on `/app/shots/[id]`): premium, with download, make a variation,
  animate to video, use in replace, the draggable before/after, fidelity status, a "how this was
  made" atelier detail, and the inline bring-it-to-life video card.

## 3D. Dedicated Video mode (`/app/video`, `VideoStudio`)
A real video space, not a checkbox. Make video from a NEW image (upload) OR an existing shot (pick
from a grid, or arrive via "Animate to video"). Options: length, motion preset (visual gallery),
motion intensity (slow-motion to energetic slider), aspect, and a free-brief. The product stays the
locked anchor. New `POST /api/video` animates either source via the i2v slug. Beta-labeled and
honest: when video is off it returns 503 cleanly with no charge; the atelier loader plays on the
result page.

## 3E. The Replace panel (`/app/replace`, `ReplacePanel`)
A dedicated swap UI: source = an uploaded image or a prior shot; product(s) to drop in (up to 5,
auto-analyzed); credits shown; wired to the engine's image-replace path; the fidelity result is
surfaced on the shot page, and the swapped result animates to video in one tap.

## Gate
- `tsc --noEmit`: clean
- `vitest run`: 110 passed, 15 live-only skipped
- `next build`: succeeds (`/app/video`, `/app/replace` added)
- runtime smoke: every app route serves (307 to login when unauthed, the auth guard), `/design` and
  the landing 200, no compile/runtime errors.
- No "muse", no "Contact Sheet", no "calling action", no native dropdowns, no vendor names, no em
  dashes.

## Deferred / honest notes
- **Authenticated visual QA**: this environment has no logged-in session, so I verified the surface
  via typecheck + build + route smoke rather than clicking through the live authed UI. Recommend a
  quick pass on the deploy.
- **Raw video-replace dual-input UI**: the Replace panel ships image-replace (the primary path); the
  one-tap "Animate to video" on the swapped result covers the motion need. The engine's
  `runReplaceVideo` (a still + a source clip) remains available at the API but its dedicated
  dual-upload screen (incl. video-file upload, which the image uploader does not accept) is deferred.
- **Bulk delete in My Shots**: select + bulk download shipped; bulk delete is deferred (no delete
  endpoint / column, and deletion is destructive, out of scope for this phase).
- Video remains gated on the Railway worker (`npm run worker`) and migration 0005 for saved products
  (both carried from Phase 2).
