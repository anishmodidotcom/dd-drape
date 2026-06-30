# Oviya — Admin dashboard + accounts system

A secure, server-gated admin dashboard for the founder, and a hardened signup → free-credits →
account flow. No DB/bucket/env/repo rename; `drape_` namespaced; RLS for users is unchanged.

## 1. Superadmin (how it is designated + enforced)
- The allowlist is `src/lib/admin/allowlist.ts`: `anish.modi@deeperdesigns.in` is built in, and more
  admins are added via the `ADMIN_EMAILS` env var (comma separated). It is read **server-side only**.
- Enforcement, `src/lib/admin/auth.ts`:
  - Pages: every `/admin/*` route goes through `requireAdminPage()` in `src/app/admin/layout.tsx`,
    which calls `notFound()` (HTTP **404**, non-leaking) for any non-admin before any admin data is
    read.
  - APIs: `/api/admin/*` calls `getAdminForApi()` and returns **403** with no data on null.
  - The check is always `getUser()` (the live session) vs the allowlist; the client is never trusted.
    The "Admin dashboard" link in the app account menu is a convenience only; the route is the
    boundary.
- Adding admins later: set `ADMIN_EMAILS=a@x.com,b@y.com` in the server env. No deploy code change.

## 2. The accounts / free-credits flow (reviewed + hardened)
- **Grant-on-signup.** A trigger `drape_on_auth_user_created` on `auth.users` INSERT runs
  `drape_handle_new_user()` → `drape_grant_credits(new.id, 400, 'signup_grant')`
  (`supabase/migrations/0001_drape_init.sql`). The `auth.users` row is created at signup, so the 400
  free credits land at signup (before email confirmation). This is the correct choice: the balance
  exists immediately and the user cannot lose it by delaying confirmation.
- **Exactly once.** One `auth.users` INSERT = one trigger = one grant. Supabase does not create a new
  `auth.users` row for an existing email, so a re-signup does not double-grant. Migration **0006**
  additionally makes `drape_handle_new_user()` idempotent (it grants only if no `signup_grant`
  transaction exists for the user), so even a re-installed trigger or a backfill cannot double-grant.
- **Atomic + ledgered.** The grant is a `SECURITY DEFINER` function that upserts the balance and
  appends a `grant` transaction in one statement; `drape_debit_credits` uses `FOR UPDATE` row locks
  for reserve/settle/refund. Balance, transactions and the `drape_credit_balances` view stay
  consistent.
- **Edge cases.** Duplicate signup → no new row, no extra grant. Unconfirmed account → already has the
  grant and can confirm later (the `/auth/callback` + `/welcome` flow from the earlier cycle handles
  confirmation; SMTP is Anish's dashboard setup). A user created before the trigger existed → admin
  can backfill with a grant.

## 3. The admin dashboard (`/admin`, premium dual-mode)
- **Overview** (`/admin`): users, 7-day signups, 7-day active users, total generations (stills vs
  videos), failure rate, credits granted/spent/refunded, and a 14-day signup sparkline.
- **Users** (`/admin/users`): every account (email, joined, confirmed status, balance, last seen),
  email/id search; click through to detail.
- **User detail** (`/admin/users/[id]`): balance, full transaction ledger, generations, models,
  saved products, joined/confirmed/last-seen, and the **grant/revoke credit control**.
- **Generations** (`/admin/generations`): all jobs across the platform with user, type, status, tier,
  fidelity result and cost; filter by status and type; spot failures.
- **System** (`/admin/system`): qc-status distribution, stuck jobs (queued/running > 20 min), recent
  failures with reasons, and the **admin audit log**.
- Built on the Oviya tokens/primitives (cards, panels, seg toggles, the brand type and accent),
  dual-mode. Final visual polish lands in the UI pass; it is genuinely usable and on-brand now.

## 4. Security model
- Every admin surface is gated server-side (404 page / 403 API) by the email allowlist; verified by a
  runtime smoke (anonymous → 404 on all `/admin/*`, 403 on `/api/admin/credits`, no data) and unit
  tests on the gate predicate.
- Admin reads use the **service-role** client (`getAdminClient`) **only behind the gate**, so RLS is
  bypassed for the operator without weakening RLS for normal users (their `drape_*` tables keep the
  owner-scoped policies; a regular session can still only read its own rows).
- The privileged write (`POST /api/admin/credits`) is server-gated, **validated**
  (`validateAdjustInput`: non-zero integer within ±1,000,000, a required reason, a valid user), writes
  the ledger **atomically** (`drape_grant_credits` for grants, `drape_admin_adjust` for revokes,
  clamped at zero), and is **audited** to `drape_admin_actions` (who, target, amount, reason, when).
- No admin data ships in any client bundle or public route; no secrets exposed. The audit table has
  RLS on with **no policies**, so only the service-role path can touch it.

## 5. Migration to apply (Anish's manual step)
Apply `supabase/migrations/0006_drape_admin.sql` on the database: the idempotent signup grant, the
`adjust` ledger kind, `drape_admin_adjust` (service_role only), and the `drape_admin_actions` audit
table. Until it is applied, grants still work (via `drape_grant_credits`) and the audit write degrades
gracefully (best-effort, never blocks the grant); **revokes require 0006** (the `drape_admin_adjust`
function and the `adjust` kind). The dashboard reads degrade gracefully if 0006 is not yet applied.

Optional env: `ADMIN_EMAILS` to add more admins.

## Gate
- `tsc --noEmit`: clean
- `vitest run`: 119 passed, 15 live-only skipped (9 new: the admin gate predicate, env extension,
  grant/revoke validation, and the migration's idempotency + service-role guards)
- `next build`: succeeds (`/admin/*`, `/api/admin/credits` registered)
- runtime smoke: anonymous → 404 on every `/admin/*`, 403 on the admin API, no data leak; app routes
  unaffected.

## Deferred / notes
- The grant/revoke is a deliberate manual operator action (atomic + audited), not auto-deduplicated by
  an idempotency key; that is the right model for a human adjustment. A per-request idempotency key
  could be added later if grants are ever automated.
- `getOverview` computes totals from typed `drape_` tables (balances as the user count proxy; jobs and
  the ledger for the rest) rather than scanning `auth.users`, which is robust at current scale; for
  very large user counts these would move to materialized counts.
- Authenticated **non-admin** denial shares the exact same gate as the anonymous case (the allowlist
  check is independent of auth state); it is covered by the predicate tests, but a fully clicked-through
  authed-non-admin run needs a live session this environment does not have.
