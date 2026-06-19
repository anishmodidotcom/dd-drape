# Oviya Studio — manual steps for Anish

Everything in the three phases is committed and pushed. These are the things only you can do,
because they involve secrets, billing, or infrastructure I must not touch.

## Required to run end to end
1. **Run the worker.** The async path (video, reconciliation) needs the Railway worker running:
   `npm run worker` (with the same server-side env as the app: `SUPABASE_SERVICE_ROLE_KEY`,
   `FAL_KEY`, `WORKER_SHARED_SECRET`, `ANTHROPIC_API_KEY`). Stills work without it; video needs it.
2. **fal.ai credit / billing.** Top up the `FAL_KEY` account and take it off trial so real
   generations don't rate-limit or fail.
3. **Anthropic key.** `ANTHROPIC_API_KEY` must be set in the app (and worker) env for the director
   (Analyze / Compose / fidelity gate) and the new visible product analysis. Without it the app
   falls back to manual category selection and the deterministic composer (no crash, but less
   magic).
4. **Deploy.** Push triggers the Vercel build. Confirm the env vars above are set in Vercel
   (Production + Preview).

## Optional / brand
5. **Support email.** `GetCreditsModal` still points at `hello@drape.studio` (kept functional so
   nothing breaks). Swap to your real Oviya support inbox when you have one.
6. **Gemini key.** `GEMINI_API_KEY` lives only in `.env.local` (gitignored) and is needed only to
   *regenerate* brand/preset assets via `npx tsx scripts/generate-assets.ts`. The 25 generated PNGs
   are committed, so production does not need the key. `FORCE=1` regenerates everything.
7. **Custom domain + metadata.** Point your domain at Vercel; the OpenGraph image is
   `/brand/hero-2.png` and titles already say Oviya Studio.

## Deliberately NOT changed (would break live shared infra)
The `drape_` Postgres namespace, the `drape-presets` and `drape-outputs` storage buckets, the
`dd-drape` repo/deploy names, all env var names (`DRAPE_VIDEO_ENABLED`, `FAL_KEY`, etc.), the
`com.drape.generation` C2PA assertion namespace, and the internal director system-prompt personas.
Only user-facing surfaces were rebranded to Oviya.

## Video flag
`DRAPE_VIDEO_ENABLED` defaults OFF. The Studio shows "Bring it to life (Beta)"; when the flag is off
the video endpoint fails cleanly with no charge. Turn it on only after you have verified the Kling
i2v slug end to end on the worker.
