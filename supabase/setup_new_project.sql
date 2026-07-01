-- ============================================================================
-- OVIYA — full setup for a FRESH Supabase project (internal codename "drape").
-- Run this ONCE, top to bottom, in the new project's SQL editor. It recreates
-- every drape_ object: tables, RLS policies, money functions, the signup-grant
-- trigger, the models/products/admin tables, constraints, and the storage
-- buckets. Tables/functions/buckets are guarded (create-if-not-exists /
-- create-or-replace / on-conflict); the RLS policies are create-once, so on a
-- FRESH project this runs clean top-to-bottom. If you ever re-run it, it is safe
-- to ignore any "policy ... already exists" errors. It never touches a non-drape
-- (CGE) object. This project is Oviya's own; the old shared project is CGE's.
--
-- After running: verify RLS is enabled and owner-scoped on every drape_ user
-- table, and that storage.buckets contains drape-outputs (private) and
-- drape-presets (public).
-- ============================================================================


-- ==================== migrations/0001_drape_init.sql ====================

-- Drape v1 schema. Shared CGE Supabase project: EVERYTHING is namespaced with drape_ (tables,
-- functions) or drape- (storage bucket), and we NEVER alter or drop any non-drape object.
--
-- Safety:
--   * Run supabase/verify_no_collision.sql FIRST and confirm it returns zero rows before applying.
--   * All objects are create-if-not-exists / create-or-replace and only touch drape_* names.
--   * The auth.users trigger is named drape_on_auth_user_created so it coexists with any CGE
--     trigger on the same table (Postgres fires all triggers).
--
-- Design rules (unchanged):
--   * RLS enabled on every table from birth, with NO permissive anon/authenticated policy.
--     Clients read only their own rows; all writes go through service-role / SECURITY DEFINER.
--   * Credits ledger is the single source of truth for spend. 1 credit = $0.01 of provider cost.
--   * Money functions are SECURITY DEFINER, search_path='', EXECUTE granted to service_role only.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- drape_credit_balances: one row per user. Single mutable balance.
-- ---------------------------------------------------------------------------
create table if not exists public.drape_credit_balances (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  balance    bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

alter table public.drape_credit_balances enable row level security;

create policy "drape_balances_select_own"
  on public.drape_credit_balances
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- drape_credit_transactions: append-only ledger. Never updated, never deleted.
--   kind: grant | reserve | settle | refund
--   amount: signed change to balance (negative = debit, positive = credit)
-- ---------------------------------------------------------------------------
create table if not exists public.drape_credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  job_id        uuid,
  kind          text not null check (kind in ('grant', 'reserve', 'settle', 'refund')),
  amount        bigint not null,
  balance_after bigint not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists drape_credit_transactions_user_idx
  on public.drape_credit_transactions (user_id, created_at desc);
create index if not exists drape_credit_transactions_job_idx
  on public.drape_credit_transactions (job_id);

alter table public.drape_credit_transactions enable row level security;

create policy "drape_transactions_select_own"
  on public.drape_credit_transactions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- drape_jobs: async generation jobs.
-- ---------------------------------------------------------------------------
create table if not exists public.drape_jobs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  user_id           uuid not null references auth.users (id) on delete cascade,
  user_email        text,
  type              text not null,            -- engine NEED, e.g. image/standard, video/hero
  provider          text not null default 'fal',
  payload           jsonb not null default '{}'::jsonb,
  status            text not null default 'queued'
                      check (status in ('queued', 'running', 'done', 'failed')),
  tier              text check (tier in ('green', 'amber', 'red')),
  qc_status         text not null default 'none'
                      check (qc_status in ('none', 'pending', 'approved')),
  estimated_credits bigint not null default 0,
  actual_credits    bigint,
  attempts          int not null default 0,
  last_error        text,
  result_ref        text,                     -- storage path for output
  thumb_ref         text,                     -- storage path for a thumbnail / first frame
  parent_job_id     uuid,                     -- e.g. video generated from a still
  fal_request_id    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists drape_jobs_user_idx on public.drape_jobs (user_id, created_at desc);
create index if not exists drape_jobs_status_idx on public.drape_jobs (status, created_at);
create index if not exists drape_jobs_fal_request_idx on public.drape_jobs (fal_request_id);

alter table public.drape_jobs enable row level security;

create policy "drape_jobs_select_own"
  on public.drape_jobs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Money functions. SECURITY DEFINER, locked search_path, service_role only.
-- ---------------------------------------------------------------------------

create or replace function public.drape_grant_credits(
  p_user_id uuid,
  p_amount  bigint,
  p_note    text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
begin
  if p_amount <= 0 then
    raise exception 'grant amount must be positive, got %', p_amount
      using errcode = 'check_violation';
  end if;

  insert into public.drape_credit_balances (user_id, balance, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id)
  do update set balance = public.drape_credit_balances.balance + p_amount,
                updated_at = now()
  returning balance into v_balance;

  insert into public.drape_credit_transactions (user_id, job_id, kind, amount, balance_after, note)
  values (p_user_id, null, 'grant', p_amount, v_balance, p_note);

  return v_balance;
end;
$$;

-- drape_debit_credits: generic signed debit used for reserve / settle / refund.
--   p_amount is the MAGNITUDE TO DEBIT (positive = subtract from balance).
--     reserve: p_amount = estimated_credits,  p_kind='reserve', p_gate=true
--     settle:  p_amount = actual - estimated, p_kind='settle',  p_gate=false  (may be negative)
--     refund:  p_amount = -reserved_credits,  p_kind='refund',  p_gate=false  (negative = credit back)
create or replace function public.drape_debit_credits(
  p_user_id uuid,
  p_amount  bigint,
  p_job_id  uuid,
  p_kind    text,
  p_gate    boolean default false,
  p_note    text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current bigint;
  v_delta   bigint;
  v_balance bigint;
begin
  if p_kind not in ('reserve', 'settle', 'refund') then
    raise exception 'drape_debit_credits invalid kind %', p_kind
      using errcode = 'check_violation';
  end if;

  select balance into v_current
    from public.drape_credit_balances
    where user_id = p_user_id
    for update;

  if not found then
    v_current := 0;
    insert into public.drape_credit_balances (user_id, balance) values (p_user_id, 0);
  end if;

  v_delta := -p_amount;

  if p_gate and (v_current + v_delta) < 0 then
    raise exception 'insufficient_credits: balance % cannot cover debit %', v_current, p_amount
      using errcode = 'check_violation';
  end if;

  update public.drape_credit_balances
    set balance = balance + v_delta,
        updated_at = now()
    where user_id = p_user_id
    returning balance into v_balance;

  insert into public.drape_credit_transactions (user_id, job_id, kind, amount, balance_after, note)
  values (p_user_id, p_job_id, p_kind, v_delta, v_balance, p_note);

  return v_balance;
end;
$$;

revoke all on function public.drape_grant_credits(uuid, bigint, text) from public;
revoke all on function public.drape_debit_credits(uuid, bigint, uuid, text, boolean, text) from public;
grant execute on function public.drape_grant_credits(uuid, bigint, text) to service_role;
grant execute on function public.drape_debit_credits(uuid, bigint, uuid, text, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic job claim for the worker (FOR UPDATE SKIP LOCKED).
-- ---------------------------------------------------------------------------
create or replace function public.drape_claim_next_job(p_types text[])
returns public.drape_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.drape_jobs;
begin
  select * into v_job
    from public.drape_jobs
    where status = 'queued' and type = any(p_types)
    order by created_at
    for update skip locked
    limit 1;

  if not found then
    return null;
  end if;

  update public.drape_jobs
    set status = 'running', attempts = attempts + 1, updated_at = now()
    where id = v_job.id
    returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.drape_claim_next_job(text[]) from public;
grant execute on function public.drape_claim_next_job(text[]) to service_role;

-- ---------------------------------------------------------------------------
-- New-user signup grant: 400 free credits ($4 of provider spend) on user creation.
-- Trigger name is drape-namespaced so it coexists with any CGE trigger on auth.users.
-- ---------------------------------------------------------------------------
create or replace function public.drape_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.drape_grant_credits(new.id, 400, 'signup_grant');
  return new;
end;
$$;

drop trigger if exists drape_on_auth_user_created on auth.users;
create trigger drape_on_auth_user_created
  after insert on auth.users
  for each row execute function public.drape_handle_new_user();

-- ==================== migrations/0002_drape_products.sql ====================

-- Drape v2: product analysis cache. Stores the Claude vision analysis per uploaded product image
-- so re-generations skip re-analysis. drape_ namespaced; RLS owner-scoped from birth.
-- Run after 0001_drape_init.sql.

create table if not exists public.drape_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  image_path  text not null,                 -- storage path under drape-outputs/uploads/<uid>/...
  analysis    jsonb,                          -- cached ProductAnalysis JSON (null until analyzed)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, image_path)
);

create index if not exists drape_products_user_idx on public.drape_products (user_id, created_at desc);

alter table public.drape_products enable row level security;

-- Owner can read only their own products. Writes go through the service-role backend.
create policy "drape_products_select_own"
  on public.drape_products
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ==================== migrations/0003_drape_money_safety.sql ====================

-- Drape v2 Phase B: money + trust safety. Idempotent ledger + stale-job reconciliation support.
-- drape_ namespaced; touches only drape_ objects. Run after 0002.

-- ---------------------------------------------------------------------------
-- Idempotent debit. reserve / settle / refund each fire AT MOST ONCE per (job_id, kind):
-- a repeated call (webhook retry, double refund from the fidelity gate + catch block, a
-- reconciler racing a late webhook) is a no-op that returns the current balance. The row lock
-- (FOR UPDATE) keeps it atomic. Signature is UNCHANGED, so the TS wrappers keep working.
-- ---------------------------------------------------------------------------
create or replace function public.drape_debit_credits(
  p_user_id uuid,
  p_amount  bigint,
  p_job_id  uuid,
  p_kind    text,
  p_gate    boolean default false,
  p_note    text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current bigint;
  v_delta   bigint;
  v_balance bigint;
  v_exists  boolean;
begin
  if p_kind not in ('reserve', 'settle', 'refund') then
    raise exception 'drape_debit_credits invalid kind %', p_kind
      using errcode = 'check_violation';
  end if;

  -- Lock the balance row first so the idempotency check and the write are atomic together.
  select balance into v_current
    from public.drape_credit_balances
    where user_id = p_user_id
    for update;

  if not found then
    v_current := 0;
    insert into public.drape_credit_balances (user_id, balance) values (p_user_id, 0);
  end if;

  -- IDEMPOTENCY: if this (job, kind) was already applied, do nothing and return the balance.
  if p_job_id is not null then
    select exists (
      select 1 from public.drape_credit_transactions
      where job_id = p_job_id and kind = p_kind
    ) into v_exists;
    if v_exists then
      return v_current;
    end if;
  end if;

  v_delta := -p_amount;

  if p_gate and (v_current + v_delta) < 0 then
    raise exception 'insufficient_credits: balance % cannot cover debit %', v_current, p_amount
      using errcode = 'check_violation';
  end if;

  update public.drape_credit_balances
    set balance = balance + v_delta,
        updated_at = now()
    where user_id = p_user_id
    returning balance into v_balance;

  insert into public.drape_credit_transactions (user_id, job_id, kind, amount, balance_after, note)
  values (p_user_id, p_job_id, p_kind, v_delta, v_balance, p_note);

  return v_balance;
end;
$$;

revoke all on function public.drape_debit_credits(uuid, bigint, uuid, text, boolean, text) from public;
grant execute on function public.drape_debit_credits(uuid, bigint, uuid, text, boolean, text) to service_role;

-- A partial unique index makes the idempotency invariant structural, not just procedural:
-- at most one reserve/settle/refund row per job. (grant rows have null job_id and are excluded.)
create unique index if not exists drape_credit_txn_job_kind_uniq
  on public.drape_credit_transactions (job_id, kind)
  where job_id is not null;

-- ---------------------------------------------------------------------------
-- Reconciler support: list jobs that are still in flight with a fal request id but whose webhook
-- has not arrived within p_minutes. The polling reconciler finalizes these from whichever signal
-- arrives first (webhook or poll). Service-role only.
-- ---------------------------------------------------------------------------
create or replace function public.drape_list_stale_jobs(p_minutes int)
returns setof public.drape_jobs
language sql
security definer
set search_path = ''
as $$
  select *
  from public.drape_jobs
  where status in ('queued', 'running')
    and fal_request_id is not null
    and updated_at < now() - make_interval(mins => p_minutes)
  order by updated_at
  limit 50;
$$;

revoke all on function public.drape_list_stale_jobs(int) from public;
grant execute on function public.drape_list_stale_jobs(int) to service_role;

-- ==================== migrations/0004_drape_models.sql ====================

-- Drape v2 Phase C: Models studio. A user creates a consistent model once and reuses it across
-- their whole catalog. Stores the creation inputs + the 4 white-bg reference image paths.
-- drape_ namespaced; RLS owner-scoped. Run after 0003.

create table if not exists public.drape_models (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  inputs        jsonb not null default '{}'::jsonb,   -- ModelInputs (ethnicity, body, hair, ...)
  image_paths   text[] not null default '{}',          -- 4 angles: front, three-quarter, side, portrait
  status        text not null default 'ready'
                  check (status in ('ready', 'failed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists drape_models_user_idx on public.drape_models (user_id, created_at desc);

alter table public.drape_models enable row level security;

create policy "drape_models_select_own"
  on public.drape_models
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ==================== migrations/0005_drape_saved_products.sql ====================

-- Oviya v4 Phase 2 (engine): save a product to the user's collection for reuse (item 8). Additive
-- only: extends the existing drape_products analysis-cache table with a "saved" flag and an optional
-- name. drape_ namespaced, owner-scoped RLS already on drape_products. Run after 0004.

alter table public.drape_products
  add column if not exists saved boolean not null default false;

alter table public.drape_products
  add column if not exists name text;

-- Fast lookup of a user's saved products.
create index if not exists drape_products_saved_idx
  on public.drape_products (user_id, updated_at desc)
  where saved;

-- ==================== migrations/0006_drape_admin.sql ====================

-- Oviya admin + accounts hardening. Additive only, drape_ namespaced, owner-scoped RLS preserved.
-- Run after 0005. Never touches a non-drape (CGE) object.

-- ---------------------------------------------------------------------------
-- 1. Make the signup free-credit grant IDEMPOTENT.
--    The grant is a trigger on auth.users INSERT (grant-on-signup), so it already fires exactly once
--    per user under normal flow. This guard additionally prevents any double-grant if the trigger is
--    ever re-installed or a backfill re-fires it: grant only if no signup_grant exists for the user.
-- ---------------------------------------------------------------------------
create or replace function public.drape_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.drape_credit_transactions
     where user_id = new.id and note = 'signup_grant'
  ) then
    perform public.drape_grant_credits(new.id, 400, 'signup_grant');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Allow an 'adjust' ledger kind for audited admin grants/revokes.
-- ---------------------------------------------------------------------------
alter table public.drape_credit_transactions
  drop constraint if exists drape_credit_transactions_kind_check;
alter table public.drape_credit_transactions
  add constraint drape_credit_transactions_kind_check
  check (kind in ('grant', 'reserve', 'settle', 'refund', 'adjust'));

-- ---------------------------------------------------------------------------
-- 3. Admin credit adjust: a single signed, atomic, audited balance change.
--    Positive = grant credits, negative = revoke (clamped so the balance never goes below zero).
--    SECURITY DEFINER, locked search_path, service_role only (the app gates the caller to an admin).
-- ---------------------------------------------------------------------------
create or replace function public.drape_admin_adjust(
  p_user_id uuid,
  p_amount  bigint,   -- signed: >0 grant, <0 revoke
  p_note    text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current bigint;
  v_delta   bigint;
  v_balance bigint;
begin
  if p_amount = 0 then
    raise exception 'admin adjust amount must be non-zero' using errcode = 'check_violation';
  end if;

  select balance into v_current
    from public.drape_credit_balances
    where user_id = p_user_id
    for update;
  if not found then
    v_current := 0;
    insert into public.drape_credit_balances (user_id, balance) values (p_user_id, 0);
  end if;

  v_delta := p_amount;
  if v_current + v_delta < 0 then
    v_delta := -v_current; -- clamp a revoke at zero, never negative
  end if;

  update public.drape_credit_balances
    set balance = balance + v_delta, updated_at = now()
    where user_id = p_user_id
    returning balance into v_balance;

  insert into public.drape_credit_transactions (user_id, job_id, kind, amount, balance_after, note)
  values (p_user_id, null, 'adjust', v_delta, v_balance, p_note);

  return v_balance;
end;
$$;

revoke all on function public.drape_admin_adjust(uuid, bigint, text) from public;
grant execute on function public.drape_admin_adjust(uuid, bigint, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Admin action audit log. RLS on with NO policies, so only the service_role client (used behind
--    the server-side admin gate) can read/write it; no authenticated user can ever see it.
-- ---------------------------------------------------------------------------
create table if not exists public.drape_admin_actions (
  id             uuid primary key default gen_random_uuid(),
  admin_id       uuid not null,
  admin_email    text,
  action         text not null,        -- e.g. 'credit_adjust'
  target_user_id uuid,
  amount         bigint,
  reason         text,
  created_at     timestamptz not null default now()
);
create index if not exists drape_admin_actions_created_idx
  on public.drape_admin_actions (created_at desc);

alter table public.drape_admin_actions enable row level security;
-- intentionally no policies: authenticated users get nothing; service_role bypasses RLS.

-- ==================== storage buckets ====================
-- drape-outputs: PRIVATE. All writes + reads go through the service-role client
--   (uploads, results, models, signed URLs). No public access, no per-user
--   policy needed: RLS on storage.objects denies anon/authenticated by default
--   and the service role bypasses it.
-- drape-presets: PUBLIC read (brand/preset imagery served by public URL).
insert into storage.buckets (id, name, public)
values ('drape-outputs', 'drape-outputs', false),
       ('drape-presets', 'drape-presets', true)
on conflict (id) do update set public = excluded.public;

-- ==================== post-checks (should all be true / non-empty) ====================
-- select relname, relrowsecurity from pg_class
--   where relname like 'drape_%' and relnamespace = 'public'::regnamespace;   -- rowsecurity = t
-- select id, public from storage.buckets where id in ('drape-outputs','drape-presets');
-- select tgname from pg_trigger where tgname = 'drape_on_auth_user_created';  -- signup grant present
