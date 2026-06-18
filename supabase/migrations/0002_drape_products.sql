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
