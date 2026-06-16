# Drape v1 exit test

Two layers: deterministic checks (no credentials) and the live external end-to-end (needs the
shared CGE Supabase project + a fal key).

## A. Deterministic checks (run in CI, no services)

```bash
npm test          # 54 tests: ledger lifecycle, estimator, registry, tier, compose, motion,
                  #           presets, formats, provenance
npm run typecheck
npm run build
```

Plus a runtime smoke test (no DB needed for these routes):

```bash
npm run build && npm run start -- -p 3210 &
curl -s localhost:3210/api/health      # {"ok":true,"service":"drape","version":"v1"}
curl -o /dev/null -w "%{http_code}" localhost:3210/app/new   # 307 -> /login when logged out
```

## B. Live external end-to-end (shared CGE project + fal)

### 0. Collision safety FIRST

This project shares CGE's Supabase. Before applying anything:

```sql
-- run supabase/verify_no_collision.sql, must return ZERO rows
-- and check the bucket:
select id from storage.buckets where id = 'drape-outputs';   -- expect zero rows
```

If anything comes back, STOP. Do not alter or drop the colliding object.

### 1. Apply schema + storage

- Apply `supabase/migrations/0001_drape_init.sql`. Confirm RLS is on for `drape_credit_balances`,
  `drape_credit_transactions`, `drape_jobs`, and there is NO permissive insert/update/delete policy.
- Create a PRIVATE storage bucket `drape-outputs`.
- In Supabase Auth, enable Email/password. (No Google in v1.)

### 2. Env

Fill `.env.local` (Next) and the Railway worker env with the same server-side values:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`FAL_KEY`, `FAL_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `WORKER_SHARED_SECRET`.

### 3. Signup grant (400 credits)

Sign up at `/signup`. The `drape_on_auth_user_created` trigger grants 400 credits:

```sql
select balance from public.drape_credit_balances where user_id = '<uid>';   -- 400
```

### 4. Cheapest-model image end-to-end (test-first rule)

In the wizard pick Advanced -> Quality "Standard" (routes to Seedream $0.04). Generate. Expect the
result screen to show the before/after and a GREEN/AMBER badge. Then:

```sql
select kind, amount, balance_after from public.drape_credit_transactions
  where user_id = '<uid>' order by created_at;
-- grant +400, reserve -4, settle 0   => balance 396
```

The PNG output and its `*.c2pa.json` provenance sidecar are stored under
`drape-outputs/results/<uid>/`.

### 5. RLS read-block

With a SECOND user's anon session, `select * from public.drape_credit_transactions;` must return
only that caller's rows, never the first user's. Same for balances and jobs.

### 6. RED block refund (no silent dead-ends)

Jewellery -> ring -> Advanced -> shot type "Detail macro" -> generate. The result screen shows the
honest "we enhance and place" message; the ledger shows reserve then refund (net zero):

```sql
-- ... reserve -N, refund +N
```

### 7. Failure refund

Force a fal error (e.g. bad reference). Job ends `failed`, the UI says credits were refunded, and
the ledger shows reserve then refund.

### 8. Video (worker)

Run the worker (`npm run worker`, with ffmpeg available). On a finished still, click Generate
video. The job is reserved + queued, the worker claims and submits it to fal i2v, and the fal
webhook stores the MP4 and settles. Watch the result screen update from "Creating your video".
