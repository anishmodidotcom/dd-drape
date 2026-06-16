-- Pre-flight collision check for the shared CGE Supabase project.
-- Run this BEFORE applying 0001_drape_init.sql. It must return ZERO rows.
-- If it returns any row, a non-Drape object already owns a name we want: STOP and reconcile.
-- This script is read-only; it never alters anything.

-- Any existing object whose name collides with what we are about to create.
-- We intentionally list our exact target names; an existing drape_* object would also surface
-- here so we never silently adopt someone else's table.

with wanted_tables(name) as (
  values ('drape_credit_balances'), ('drape_credit_transactions'), ('drape_jobs')
),
wanted_functions(name) as (
  values ('drape_grant_credits'), ('drape_debit_credits'),
         ('drape_claim_next_job'), ('drape_handle_new_user')
),
wanted_triggers(name) as (
  values ('drape_on_auth_user_created')
)
select 'table' as kind, t.tablename as name
  from pg_tables t
  join wanted_tables w on w.name = t.tablename
  where t.schemaname = 'public'
union all
select 'function' as kind, p.proname as name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join wanted_functions w on w.name = p.proname
  where n.nspname = 'public'
union all
select 'trigger' as kind, tg.tgname as name
  from pg_trigger tg
  join wanted_triggers w on w.name = tg.tgname
  where not tg.tgisinternal;

-- Storage bucket check (run separately; storage.buckets):
--   select id from storage.buckets where id = 'drape-outputs';
-- Expect zero rows before creating the bucket.
