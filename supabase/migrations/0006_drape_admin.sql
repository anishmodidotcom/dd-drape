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
