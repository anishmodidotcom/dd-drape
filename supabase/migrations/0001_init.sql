-- Drape Phase 0: engine spine schema.
--
-- Design rules enforced here:
--   * RLS enabled on every table from birth, with NO permissive anon/authenticated policy.
--     The service-role backend bypasses RLS. Clients can only read their own rows via the
--     SELECT policies below; all writes go through service-role / SECURITY DEFINER functions.
--   * Credits ledger is the single source of truth for spend. 1 credit = $0.01 of provider cost.
--   * Money functions are SECURITY DEFINER, search_path='', EXECUTE granted to service_role only.
--
-- Apply with the Supabase CLI:  supabase db push   (or paste into the SQL editor).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- credit_balances: one row per user. Single mutable balance.
-- ---------------------------------------------------------------------------
create table if not exists public.credit_balances (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  balance    bigint not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

alter table public.credit_balances enable row level security;

-- Users may READ their own balance. No insert/update/delete policy => clients cannot mutate.
create policy "balances_select_own"
  on public.credit_balances
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- credit_transactions: append-only ledger. Never updated, never deleted.
--   kind: grant | reserve | settle | refund
--   amount: signed change to balance (negative = debit, positive = credit)
-- ---------------------------------------------------------------------------
create table if not exists public.credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  job_id        uuid,
  kind          text not null check (kind in ('grant', 'reserve', 'settle', 'refund')),
  amount        bigint not null,
  balance_after bigint not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists credit_transactions_user_idx
  on public.credit_transactions (user_id, created_at desc);
create index if not exists credit_transactions_job_idx
  on public.credit_transactions (job_id);

alter table public.credit_transactions enable row level security;

create policy "transactions_select_own"
  on public.credit_transactions
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- jobs: async generation jobs.
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,            -- defaults to user_id today; room for orgs later
  user_id           uuid not null references auth.users (id) on delete cascade,
  user_email        text,
  type              text not null,            -- engine NEED, e.g. image/standard, video/hero
  provider          text not null default 'fal',
  payload           jsonb not null default '{}'::jsonb,
  status            text not null default 'queued'
                      check (status in ('queued', 'running', 'done', 'failed')),
  estimated_credits bigint not null default 0,
  actual_credits    bigint,
  attempts          int not null default 0,
  last_error        text,
  result_ref        text,                     -- storage path / signed-url key for output
  fal_request_id    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists jobs_user_idx on public.jobs (user_id, created_at desc);
create index if not exists jobs_status_idx on public.jobs (status, created_at);
create index if not exists jobs_fal_request_idx on public.jobs (fal_request_id);

alter table public.jobs enable row level security;

create policy "jobs_select_own"
  on public.jobs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Money functions. SECURITY DEFINER, locked search_path, service_role only.
-- ---------------------------------------------------------------------------

-- grant_credits: add credits to a balance (signup grant, manual top-up).
-- Upserts the balance row, appends a 'grant' transaction. Returns new balance.
create or replace function public.grant_credits(
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

  insert into public.credit_balances (user_id, balance, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id)
  do update set balance = public.credit_balances.balance + p_amount,
                updated_at = now()
  returning balance into v_balance;

  insert into public.credit_transactions (user_id, job_id, kind, amount, balance_after, note)
  values (p_user_id, null, 'grant', p_amount, v_balance, p_note);

  return v_balance;
end;
$$;

-- debit_credits: generic signed debit used for reserve / settle / refund.
--   p_amount is the MAGNITUDE TO DEBIT (positive = subtract from balance).
--     reserve: p_amount = estimated_credits,  p_kind='reserve', p_gate=true
--     settle:  p_amount = actual - estimated, p_kind='settle',  p_gate=false  (may be negative)
--     refund:  p_amount = -reserved_credits,  p_kind='refund',  p_gate=false  (negative = credit back)
--   p_gate=true rejects the operation if it would drive the balance below zero.
-- Returns the new balance.
create or replace function public.debit_credits(
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
    raise exception 'debit_credits invalid kind %', p_kind
      using errcode = 'check_violation';
  end if;

  -- Lock the balance row for the duration of the transaction.
  select balance into v_current
    from public.credit_balances
    where user_id = p_user_id
    for update;

  if not found then
    v_current := 0;
    insert into public.credit_balances (user_id, balance) values (p_user_id, 0);
  end if;

  -- A debit reduces the balance; signed amount applied as a negative delta.
  v_delta := -p_amount;

  if p_gate and (v_current + v_delta) < 0 then
    raise exception 'insufficient_credits: balance % cannot cover debit %', v_current, p_amount
      using errcode = 'check_violation';
  end if;

  update public.credit_balances
    set balance = balance + v_delta,
        updated_at = now()
    where user_id = p_user_id
    returning balance into v_balance;

  insert into public.credit_transactions (user_id, job_id, kind, amount, balance_after, note)
  values (p_user_id, p_job_id, p_kind, v_delta, v_balance, p_note);

  return v_balance;
end;
$$;

-- Lock down execution: revoke from public/anon/authenticated, grant only to service_role.
revoke all on function public.grant_credits(uuid, bigint, text) from public;
revoke all on function public.debit_credits(uuid, bigint, uuid, text, boolean, text) from public;
grant execute on function public.grant_credits(uuid, bigint, text) to service_role;
grant execute on function public.debit_credits(uuid, bigint, uuid, text, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic job claim for the worker. Claims one queued job of the given types,
-- flips it to running, bumps attempts. SKIP LOCKED so parallel workers don't collide.
-- ---------------------------------------------------------------------------
create or replace function public.claim_next_job(p_types text[])
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  select * into v_job
    from public.jobs
    where status = 'queued' and type = any(p_types)
    order by created_at
    for update skip locked
    limit 1;

  if not found then
    return null;
  end if;

  update public.jobs
    set status = 'running', attempts = attempts + 1, updated_at = now()
    where id = v_job.id
    returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.claim_next_job(text[]) from public;
grant execute on function public.claim_next_job(text[]) to service_role;

-- ---------------------------------------------------------------------------
-- New-user signup grant: 100 free credits ($1 of provider spend) on user creation.
-- Stubbed payments (Phase 0/Section 9): keeps the ledger live and correct.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.grant_credits(new.id, 100, 'signup_grant');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
