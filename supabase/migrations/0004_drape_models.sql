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
