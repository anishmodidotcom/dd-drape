# Oviya Studio — Phase 3 (Landing + cohesion + onboarding)

## Landing page (`src/app/page.tsx`)
Rebuilt as a Met-Gala-grade editorial, entirely from the fresh Gemini brand assets (the live product
engine stays on fal). Session-aware via `getUser` (logged-out gets Sign in / Try Oviya free;
logged-in gets Enter the studio).

Sections, top to bottom:
1. Header: Oviya wordmark + session-aware nav.
2. Hero: editorial split, the `hero-1` emerald-gown portrait with a gradient scrim, "Your product.
   Your muse. Your shoot." with the gold-gradient serif accent and Framer Motion entrance (Reveal).
3. **Before/after centerpiece** ("Will it keep my exact product? Drag to reveal"): all three
   corresponding pairs as draggable sliders, the persuasive proof that the exact garment is kept.
4. Full-bleed `hero-2` campaign banner: "One muse, your whole catalogue."
5. The lookbook: the six gallery editorials with glass caption chips.
6. Editorials strip: the eight signature Looks ("or describe your own").
7. How it works: Upload / Direct / Shoot, in fashion vocabulary.
8. **Credibility line**, placed tastefully as a centered serif pull-quote: "The intelligence behind
   Oviya is built with veterans from the fashion and photography industry."
9. Simple credits explainer, FAQ, footer (Terms / Privacy / provenance note).

All motion is Reveal (transform + opacity, reduced-motion aware); the global film grain sits over
the whole page.

## Cohesion
- Auth screens (`(auth)/layout.tsx`) are now an editorial split: the `saree` gallery image with a
  scrim and the "Every product, a work of art." pull-quote on the left, the form on the right;
  collapses to a single column on mobile.
- Consistent fashion vocabulary across the app: The Studio / On set, Editorials, Casting / muses,
  Posing, Location, Light, Contact sheet, Shoot, Reshoot, Bring it to life.

## Onboarding
The Studio's empty canvas now offers "See an example shoot" which reveals a real draggable
before/after (the chikankari kurta pair) so a brand-new user sees the value before uploading,
without any engine call or spend. The set art and "step on set" copy remain the default.

## Gate
- `tsc --noEmit`: clean
- `vitest run`: 90 passed, 15 live-only skipped
- `next build`: succeeds
- Runtime: `/` 200 referencing local Gemini assets, `/login` + `/signup` 200, asset 200, no runtime
  errors. The before/after slider is the same component proven in Phase 2 to render at real
  non-zero pixel dimensions.
