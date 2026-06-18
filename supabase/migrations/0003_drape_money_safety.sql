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
