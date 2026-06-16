# Drape

Your product. Your model. Your shot. Premium fashion photography, generated.

Drape turns a photo of a real apparel or jewellery product into premium photo and video output
that preserves the actual product's exact details. This is reference-locked (image-to-image)
generation, not text-to-image. Product fidelity is the product.

## Status: v1 (all phases)

Engine spine, fidelity core, shot-spec UI + presets, video, and compliance are built and tested.

- Engine spine: model router, prepaid credits ledger (reserve at submit, settle the delta, refund
  on failure), async jobs, fal webhook (middleware whitelist + signature verify), RLS, auth.
- Fidelity core: uploads, reference-locked compose with per-category product-lock language, model
  selection by quality + shot type, RED-tier policy (enhance vs honest block).
- Shot UI: wizard (upload, category/sub-type, presets vs advanced, video toggle, review with live
  estimate + tier badge), result screen with before/after reveal, tier behaviour (GREEN/AMBER QC/
  RED), My shots, Credits + payments stub.
- Video: i2v from a generated still (worker submits, webhook settles), motion presets with full
  motion prompts, ffmpeg stitching capability for longer sequences.
- Compliance: C2PA-style provenance sidecar on every output, "Created with AI" label toggle.

Deferred (out of v1 scope): catalog-consistency LoRA, live payments, WhatsApp, vernacular UI.

## Shared CGE Supabase project

Drape runs in CGE's Supabase. Everything is namespaced and we never touch a non-drape object:

- Tables: `drape_credit_balances`, `drape_credit_transactions`, `drape_jobs`.
- Functions: `drape_grant_credits`, `drape_debit_credits`, `drape_claim_next_job`,
  `drape_handle_new_user`. Trigger `drape_on_auth_user_created` coexists with any CGE trigger.
- Storage bucket: `drape-outputs` (private), with `uploads/` and `results/` prefixes.
- Run `supabase/verify_no_collision.sql` FIRST; it must return zero rows before applying the
  migration.

## Architecture

```
Browser ──► Next.js (Vercel) ──► fal.ai            (sync: images, try-on, edits)
                │  │
                │  └─► drape_jobs (Supabase Postgres, RLS)
                │
                └─► Railway worker ──► fal.ai       (async: video i2v, ffmpeg stitch)
                          │
        fal webhook ◄─────┘  POST /api/jobs/fal-webhook  (settles credits)
```

## Setup

1. `cp .env.example .env.local` and fill values (see `.env.example`). Email/password auth only.
2. Run `supabase/verify_no_collision.sql`, confirm zero rows, then apply
   `supabase/migrations/0001_drape_init.sql`.
3. Create a private Storage bucket `drape-outputs`.
4. `npm install && npm run dev`.
5. Worker: `npm run worker` (Railway, with ffmpeg). See `worker/README.md`.

## Credits ledger (single source of truth)

1 credit = $0.01 = 1 cent. Estimates round up. RESERVE at submit gates on balance. SETTLE the
delta at completion. REFUND on failure and on a RED block. Signup grants 400 credits. Money
functions are `SECURITY DEFINER`, `search_path=''`, `service_role` only.

## Tests

```bash
npm test         # 54 deterministic unit tests, no services
npm run typecheck
npm run build
```

The full live exit test (real Supabase + fal) is in `docs/EXIT_TEST.md`.
