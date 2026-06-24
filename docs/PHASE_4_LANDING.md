# Oviya v4 - Phase 4: the landing + pricing

The public experience and the credits structure, on the Phase 1 brand system and Phase 1 imagery.
Session-aware, dual-mode, performance-engineered with real WebGL and graceful fallbacks. No
forbidden terms, no vendor names, no em dashes; the single support email everywhere.

## 4A. The immersive landing (`src/components/landing/*`, `src/app/page.tsx`)
The page is composed by `LandingExperience` (Lenis smooth scroll, disabled under reduced-motion).
1. **Branded pre-loader** (`Preloader`) tied to actual hero-asset decode: the wordmark + a hairline
   progress strip + a percentage, revealing the experience when critical images are ready, with a
   hard timeout so it never hangs; instant under reduced-motion.
2. **Cinematic hero** (`Hero`): an inhabited set with the alive mesh behind, mouse parallax on the
   image and copy, scroll fade/lift, the wordmark register, the positioning line, ONE witty
   session-aware CTA ("Enter the Studio" / "Start your shoot"). Stunning in both themes.
3. **The signature gallery-in-the-void** (`VoidGallery`): a real react-three-fiber scene, a single
   persistent `<Canvas>`, twelve floating editorial photographs (drei `<Image>`) the camera travels
   through, driven by the section's own scroll progress (framer `useScroll`, cooperating with
   Lenis), the frame loop PAUSED off-screen via IntersectionObserver, dpr-capped. Falls back to a
   static masonry editorial gallery (`VoidGalleryFallback`) under reduced-motion, no-WebGL, or while
   the client chunk loads (the three.js bundle is a lazy `ssr:false` dynamic import, so it never
   touches first paint or SSR).
4. **Before/after** (`BeforeAfterGallery`): the three verified-corresponding pairs, draggable,
   premium.
5. **Lookbook in Edits** (`Lookbook`): organized into three curated edits (Heritage, The Global Eye,
   Fine Things), international + Indian, apparel + jewellery + accessories, ordered not a wall.
6. **Looks showcase** (`LooksShowcase`): the eight named editorials with a spring hover.
7. **Alive mesh gradient** (`AliveMesh`): a real GLSL fbm shader on a lightweight WebGL canvas in the
   oxblood/indigo palette, reading the live theme tokens (correct in light and dark), paused
   off-screen and under reduced-motion; if WebGL is absent it renders nothing and the Phase 1
   `.alive-wash` CSS scaffold shows through.
8. **Sell the intelligence** (`Intelligence`): a designed grid of the real atelier process (Reading
   the garment ... Final retouch), framed as depth, no vendor/model names.
9. **The fidelity guarantee** (`FidelityGuarantee`): "The exact product, or your credits back."
10. **The journey** (`Journey`): an elegant Upload / Direct / Shoot abstraction, not the literal UI.
11. **Oversized editorial type** as graphic statements throughout (and the reduced-motion fallback
    content).
12. **The global message** (`GlobalMessage`): "Let your imagination go international," over the alive
    mesh.
13. **The credibility line** (`Credibility`), tastefully centered.
14. **A real FAQ** (`FAQSection`): eight questions a fashion/jewellery brand actually asks (fidelity,
    ownership/rights, formats, turnaround, credits, limits, privacy, model reuse).
15. **Footer**: wordmark, Terms/Privacy, the single support email, a v4 version line.
16. Only Phase 1 assets are used (the v4 `public/v4` set + the v3 before/after pairs); the old
    inline landing imagery is gone.

## 4B. Pricing / credits (`src/lib/pricing.ts`, `Pricing` section + in-app)
- The free signup grant is communicated (`FREE_GRANT`).
- **Three volume tiers** (Atelier / Studio / Maison), each showing the legible promise computed from
  the engine's real credit costs: "about N hero stills, or N draft stills, or N short videos."
- A premium dual-mode pricing section on the landing; the in-app Credits buy path uses the contact
  stub to the single support email.
- **Final prices drop into one config**: `TIERS[].price`, `CURRENCY`, and `TIERS[].credits` in
  `src/lib/pricing.ts`, with `LAUNCH_PRICING` marking them provisional. `Tier.id` is the hook a real
  provider (Razorpay/Stripe) binds to later, no UI change needed.

## 4C. Cohesion + onboarding
- Brand, type, colour, motion, terminology and voice are consistent across landing, auth, studio,
  tabs, video, replace and credits. No "muse", no "Contact Sheet", no "calling action", no native
  dropdowns, no vendor names, no em dashes (swept). Every loading state is the atelier loader; every
  empty state is branded.
- Auth screens are editorial, dual-mode, session-aware (authed users are redirected to the studio).
- A version indicator (`Oviya Studio, v4`) sits in the landing footer and the in-app account menu.
- **Onboarding**: a motivating empty studio ("Hand us the garment, we'll handle the drama") with
  "Try a sample piece", which copies the Phase 1 sample product into the user's own uploads
  (`POST /api/uploads/sample`) so a brand-new user reaches a real first result in one tap, plus
  light non-blocking inline coaching and "See an example".

## Performance + accessibility
- WebGL is a lazy `ssr:false` chunk; first paint and SSR render the static sections.
- Both WebGL surfaces pause off-screen (IntersectionObserver) and honor `prefers-reduced-motion`
  (static fallbacks; Lenis off).
- dpr is capped (1.5-1.6), textures are the compressed PNGs, the void scene caps at twelve planes.
- Fully responsive (hero/grids collapse; the gallery falls back to masonry on small/weak devices).

## Gate
- `tsc --noEmit`: clean
- `vitest run`: 110 passed, 15 live-only skipped
- `next build`: succeeds (three is a lazy client chunk; `/api/uploads/sample` added)
- runtime smoke: `/` 200 with the void type, fidelity guarantee, global message, the three pricing
  tiers, the credibility line, and the session-aware CTA all present; no runtime errors.

## The return loop (noted, not done here)
Gemini money-shot regeneration (blocked on the depleted Gemini key), further brand-feel polish, a
"Claude Design" extraction, live payments/commerce (the tiers are structured for it), and final live
authenticated QA remain. This phase touched none of the engine; it consumed Phase 1 assets and the
Phase 2/3 APIs only.
