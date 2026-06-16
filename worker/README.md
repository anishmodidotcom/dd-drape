# Drape video worker (Railway)

Long-running poller that drives async (video) jobs. Vercel functions time out at ~300s; video
runs longer, so it runs here.

## What it does

1. Polls the `jobs` table for queued video needs.
2. Claims one atomically via `claim_next_job` (`FOR UPDATE SKIP LOCKED`).
3. Submits it to fal with the webhook URL. The Next webhook route settles credits when fal
   posts back.

Credits are already RESERVED by the Next API route at submit time, so the worker only touches the
ledger to REFUND if fal submission itself fails.

## Run

```bash
npm install
npm run worker     # tsx worker/index.ts
```

## Required env (same server-side values as the app)

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FAL_KEY`
- `NEXT_PUBLIC_APP_URL` (used to build the webhook URL)
- `WORKER_POLL_MS` (optional, default 5000)

## Deploy separately

This worker deploys to Railway independently of the Vercel app. A merge to the Next app does NOT
redeploy the worker. After changing shared logic (registry slugs, ledger flow), redeploy BOTH.
Start command on Railway: `npm run worker`.
