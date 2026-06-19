-- Phase 3 scale follow-up: dashboard product lists show all products (active + inactive)
-- newest-first, so the active-filtered storefront index from Phase 2 cannot satisfy the order
-- without an extra sort once a store has many products.

create index if not exists products_store_created_idx
  on public.products (store_id, created_at desc);
