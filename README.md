# Drape

Your product. Your model. Your shot. Premium fashion photography, generated.

Drape turns a photo of a real apparel or jewellery product into premium photo and video output
that preserves the actual product's exact details. This is reference-locked (image-to-image)
generation, not text-to-image. Product fidelity is the product.

## Status: Phase 0 (engine spine)

Phase 0 builds the spine the rest of the product hangs on. It is complete and tested.

- Multi-model router: callers ask for a NEED, never a model slug. `src/lib/engine/registry.ts`.
- Cost estimator: dry-run cost in credits before any spend. `src/lib/engine/estimator.ts`.
- Prepaid credits ledger: reserve at submit, settle the delta, refund on failure. The ledger is
  the single source of truth for spend. 1 credit = $0.01 of provider cost.
- Async job flow: jobs table, sync path for images, worker + webhook path for video.
- fal webhook: two-layer auth (middleware whitelist + signature verification).
- RLS from birth: every table has RLS enabled with no permissive anon/authenticated policy.
- Auth: Supabase email/password + Google OAuth (wired via `@supabase/ssr`).
- AI-readiness tier router: GREEN / AMBER / RED classification. `src/lib/engine/tier.ts`.

### Phase 0 exit test

The billing lifecycle (reserve -> settle -> refund, insufficient-credits gating, ledger
conservation) and the router/estimator are proven deterministically:

```bash
npm test          # 28 unit tests, no external services required
npm run typecheck
npm run build
```

To run the full external end-to-end (real reserve -> $0.04 Seedream generation -> settle ->
output stored, plus an RLS read check), set the env vars below and follow
`docs/PHASE0_EXIT_TEST.md`.

## Architecture

```
Browser ──► Next.js (Vercel) ──► fal.ai            (sync: images, try-on, edits)
                │  │
                │  └─► jobs table (Supabase Postgres, RLS)
                │
                └─► Railway worker ──► fal.ai       (async: video, ffmpeg stitching)
                          │
        fal webhook ◄─────┘  POST /api/jobs/fal-webhook  (settles credits)
```

- Frontend + API routes: Next.js App Router on Vercel.
- Database: Supabase Postgres. RLS from birth. Service-role key server-side only.
- Worker: separate long-running service on Railway for video + ffmpeg. Deploys independently of
  the Next app; a merge to the app does NOT redeploy the worker.
- Inference: fal.ai. One `FAL_KEY`, server-side only.
- Storage: private Supabase Storage buckets, signed URLs.

## Setup

1. Copy env: `cp .env.example .env.local` and fill in values (see `.env.example`).
2. Create the schema: apply `supabase/migrations/0001_init.sql` (Supabase CLI `supabase db push`
   or paste into the SQL editor). This enables RLS and creates the money functions.
3. Create a private Storage bucket named `outputs`.
4. Enable Google OAuth in the Supabase Auth dashboard.
5. Install + run: `npm install && npm run dev`.

## The credits ledger (single source of truth)

- 1 credit = $0.01 = 1 US cent. Estimates round UP so we never under-reserve.
- RESERVE at submit debits the estimate and gates on balance. No balance, no generation.
- SETTLE the delta at completion charges `actual - estimated` (negative credits part back).
- REFUND on failure returns the full reservation.
- Money functions (`grant_credits`, `debit_credits`, `claim_next_job`) are `SECURITY DEFINER`,
  `search_path=''`, EXECUTE granted to `service_role` only. Verify signatures before calling.

## Deploy

- App: Vercel. Set all env vars except they may differ from the worker's.
- Worker: Railway. `npm run worker` (see `worker/README.md`). Set the server-side env vars there
  too. Deploy it separately and keep it on current code.

## Phases

- Phase 0: engine spine. (this)
- Phase 1: fidelity core (reference-locked generation, try-on, bg-remove, inpainting).
- Phase 2: shot-spec wizard + presets + tier behavior + result screen.
- Phase 3: video (i2v pipeline, worker + ffmpeg stitching, motion presets).
- Phase 4: polish + compliance/provenance + marketing site.
