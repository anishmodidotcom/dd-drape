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
