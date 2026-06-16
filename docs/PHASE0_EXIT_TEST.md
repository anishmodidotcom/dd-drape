# Phase 0 exit test

Phase 0 ships only when the spine works end-to-end: a fake $0.04 Seedream job reserves,
generates, settles, and stores its output with the ledger decrementing correctly, and RLS blocks
a direct client read of another user's rows.

## A. Deterministic checks (no external services)

These run in CI and locally with no credentials. They prove the billing math and routing.

```bash
npm test          # reserve/settle/refund lifecycle, gating, ledger conservation, router, tiers
npm run typecheck
npm run build
```

Expected: 28 tests pass, typecheck clean, build succeeds.

## B. External end-to-end (real Supabase + fal)

Requires a Supabase project, the schema applied, an `outputs` bucket, and a real `FAL_KEY`.

1. Apply `supabase/migrations/0001_init.sql`. Confirm RLS is enabled on `credit_balances`,
   `credit_transactions`, and `jobs`, and that there is NO permissive insert/update/delete policy.
2. Sign up a user. The `on_auth_user_created` trigger grants 100 credits. Confirm with:
   ```sql
   select balance from public.credit_balances where user_id = '<uid>';   -- 100
   ```
3. Submit a Seedream job (cheapest model, test here first):
   ```bash
   curl -X POST "$NEXT_PUBLIC_APP_URL/api/jobs/submit" \
     -H 'content-type: application/json' \
     -H "cookie: <authenticated session cookie>" \
     -d '{"need":"image/standard","falInput":{"prompt":"a product photo on white"}}'
   ```
   Expect `202` with `{ status: "done", estimatedCredits: 4, resultPath: "<uid>/<jobId>.png" }`.
4. Confirm the ledger:
   ```sql
   select balance from public.credit_balances where user_id = '<uid>';   -- 96
   select kind, amount, balance_after from public.credit_transactions
     where user_id = '<uid>' order by created_at;                        -- grant +100, reserve -4, settle 0
   ```
   The job's output is stored in the private `outputs` bucket and served via signed URL.
5. RLS read check: with a SECOND user's anon session, try to read the first user's rows:
   ```sql
   select * from public.credit_transactions;   -- returns only the caller's own rows, never the first user's
   ```
   A direct client read of another user's balance, transactions, or jobs must return nothing.

## C. Failure + refund path

Force a fal failure (bad input) and confirm the job ends `failed` and the reservation is refunded
(balance returns to its pre-reserve value, a `refund` transaction is recorded). No free spend, no
silent debit.
