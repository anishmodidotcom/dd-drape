# Oviya — standing up the dedicated Supabase + Resend (migrating off shared CGE)

This is the runbook to move Oviya onto its OWN Supabase project and OWN Resend account, fully
severing from the shared CGE project. Clean slate: the 2 old test users / their shots / credits are
NOT migrated. Internal naming stays "drape"; only env var VALUES change. After this, the OLD shared
Supabase project belongs entirely to CGE and Oviya never touches it again.

Code + config already changed in this repo (done):
- Every user-facing email is now `support@oviyastudio.com` (mailto in the credits modal, the pricing
  tiers, the landing footer). No `deeperdesigns.in`, no `drape.studio`, no `hello@` anywhere in the
  app. Grep proof: the only email literals in `src/` are `support@oviyastudio.com` (contact), the
  server-side admin allowlist (`support@`/`admin@oviyastudio.com`), and the `you@email.com` input
  placeholder.
- Superadmin allowlist rebased to the oviyastudio.com domain (`src/lib/admin/allowlist.ts`):
  `support@oviyastudio.com` and `admin@oviyastudio.com` are built in; add any other login via the
  `ADMIN_EMAILS` env var.
- `NEXT_PUBLIC_APP_URL` default is `https://oviyastudio.com` (`.env.example`).
- Consolidated setup SQL produced: `supabase/setup_new_project.sql`.

Everything below is YOUR manual step (dashboard / env), because I cannot reach your accounts.

---

## STEP 1 — Recreate the full schema (SQL editor of the NEW project)
Open the NEW Supabase project → SQL editor → paste and run the whole of
**`supabase/setup_new_project.sql`** once, top to bottom. It is the six migrations (0001-0006) in
order plus the storage buckets, and it recreates EVERY drape_ object:
- Tables: `drape_credit_balances`, `drape_credit_transactions`, `drape_jobs`, `drape_products`,
  `drape_models`, `drape_admin_actions`.
- RLS: enabled + owner-scoped `select` on every user table; `drape_admin_actions` has RLS on with no
  policies (service-role only).
- Functions: `drape_grant_credits`, `drape_debit_credits`, `drape_claim_next_job`,
  `drape_handle_new_user`, `drape_list_stale_jobs`, `drape_admin_adjust` (all service_role only).
- Trigger: `drape_on_auth_user_created` on `auth.users` (the 400-credit signup grant, idempotent).
- Constraints: the `kind in ('grant','reserve','settle','refund','adjust')` check.

Alternatively, run the six files in order (same result): `0001_drape_init.sql`,
`0002_drape_products.sql`, `0003_drape_money_safety.sql`, `0004_drape_models.sql`,
`0005_drape_saved_products.sql`, `0006_drape_admin.sql`, then the storage block at the bottom of the
consolidated file.

Post-checks (run these; all should hold):
```sql
select relname, relrowsecurity from pg_class
  where relname like 'drape_%' and relnamespace = 'public'::regnamespace;   -- rowsecurity = t on all
select tgname from pg_trigger where tgname = 'drape_on_auth_user_created';  -- one row
select id, public from storage.buckets where id in ('drape-outputs','drape-presets');
```

## STEP 2 — Storage buckets
The consolidated script already creates them:
- `drape-outputs` — **PRIVATE** (`public = false`). All writes and reads go through the service-role
  client (uploads, results, models, signed URLs); no per-user policy is needed because RLS on
  `storage.objects` denies anon/authenticated by default and the service role bypasses it.
- `drape-presets` — **PUBLIC** (`public = true`) for brand/preset imagery served by public URL.

If you prefer the dashboard: Storage → New bucket → `drape-outputs` (Public OFF), then `drape-presets`
(Public ON).

**Assets to move:** the brand/landing imagery the app serves is committed in the repo under
`public/` (the v4 set + v3 before/after), so it deploys with the app and needs NOTHING in storage.
The only things that lived in the old `drape-presets` bucket were the legacy preset thumbnails
(`thumbUrl(...)` in `src/lib/shot/thumbnails.ts`, referenced by the studio control galleries). Those
tiles fall back to a clean labelled placeholder when the bucket URL is empty, so the app is not
broken without them. When the separate Gemini regeneration lands, upload the regenerated preset
thumbnails to the new `drape-presets` bucket (same paths as `preset-thumbnails.json`). Do not block on
this.

## STEP 3 — Env vars (VALUES from the NEW project; NAMES unchanged)
Set these in **Vercel** (Project → Settings → Environment Variables, Production + Preview):
| Name | Value source |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | NEW project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | NEW project anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | NEW project service-role key (secret) |
| `NEXT_PUBLIC_APP_URL` | `https://oviyastudio.com` |
| `ANTHROPIC_API_KEY` | unchanged |
| `FAL_KEY`, `FAL_WEBHOOK_SECRET` | unchanged |
| `WORKER_SHARED_SECRET` | unchanged (must match the worker) |
| `DRAPE_VIDEO_ENABLED` | `true` only once the worker is running |
| `GEMINI_API_KEY` | unchanged (asset regen only) |
| `ADMIN_EMAILS` | optional: your personal login email if not support@/admin@oviyastudio.com |

Set these on the **Railway worker** (must read the SAME new project):
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FAL_KEY`, `WORKER_SHARED_SECRET`,
`NEXT_PUBLIC_APP_URL=https://oviyastudio.com` (the worker calls the app's webhook/reconcile). Anon
key is not needed by the worker.

Secret split re-verified: only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are
`NEXT_PUBLIC_` (safe to expose). The service-role key, FAL key, Anthropic key, Gemini key and worker
secret are all NON-public server-side vars. No secret is in a `NEXT_PUBLIC_` var.

## STEP 4 — Auth + email on the NEW project (dashboard)
Authentication → URL Configuration:
- **Site URL:** `https://oviyastudio.com`
- **Redirect URLs (add all):**
  `https://oviyastudio.com/auth/callback`,
  `https://www.oviyastudio.com/auth/callback` (if you use www),
  `http://localhost:3000/auth/callback` (local dev).
- **Email confirmation:** ON (Authentication → Providers → Email → "Confirm email").

Authentication → SMTP settings → enable Custom SMTP with the NEW Resend account:
- Sender name: `Oviya Studio`
- Sender email: `support@oviyastudio.com`
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the NEW Resend API key

Resend (new account): verify the `oviyastudio.com` domain. Add/confirm these DNS records (your DNS
already has SPF/DMARC; Resend will show the exact values):
- SPF: a `TXT` on the sending subdomain including `include:_spf.resend.com` (or Resend's shown value).
- DKIM: the `resend._domainkey` (and any additional) `CNAME`/`TXT` records Resend generates.
- Return-Path / MX: the `send.` subdomain `MX` + `TXT` Resend shows.
- Keep your existing `DMARC` record.
Wait for Resend to mark the domain "Verified" before relying on delivery.

The app's confirmation flow is unchanged and already correct for this: `signUp` sets
`emailRedirectTo` to `${origin}/auth/callback`; `/auth/callback` completes the code exchange and
sends the user to `/welcome`; the 400-credit grant fires from the STEP-1 trigger on the new project.

## STEP 5 — Verification checklist (end to end on the new project)
1. Deploy with the new env vars. App boots (landing 200).
2. Sign up a fresh account at `https://oviyastudio.com/signup`.
3. Receive the confirmation email **from `support@oviyastudio.com`** (check it is the Resend sender,
   not a Supabase default).
4. Click the link → land on `/welcome` (not a dead page) → "Enter the Studio".
5. In the studio / credits tab, confirm the balance is **exactly 400** free credits, granted once
   (Credits tab shows a single "Signup credit" transaction).
6. Upload a product, run a shoot, confirm it generates and the ledger reserves/settles correctly.
7. RLS check: with a second fresh account, confirm you only see your own shots/credits (a user can
   never read another user's rows).
8. Admin check: sign in as `support@oviyastudio.com` (or an `ADMIN_EMAILS` address) → `/admin` loads;
   sign in as a normal user → `/admin` returns 404 and `/api/admin/*` returns 403.
9. Worker: start `npm run worker` on Railway with the new env; set `DRAPE_VIDEO_ENABLED=true`; run a
   video and confirm it completes.

## Notes
- Grant timing: the free credits are granted **on signup** (the `auth.users` insert trigger), so the
  balance exists immediately and cannot be lost by delaying confirmation; the migration 0006 guard
  makes it exactly-once even if the trigger is ever re-installed.
- The old shared Supabase project is now 100% CGE's. Oviya reads/writes only the new project. Nothing
  in this migration touched a non-drape object.
