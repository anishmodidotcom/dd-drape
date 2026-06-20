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
