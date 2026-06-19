-- Phase 3.5: decoupled image upload pipeline (R2 + Queue + Container).
-- The edge inserts a `pending` row and enqueues a job; a Cloudflare Container (Node + sharp)
-- re-encodes the bytes and flips the row to `ready`/`rejected` via the service role. A pending
-- or rejected image NEVER blocks store creation, QR generation, or pay-at-pickup orders.

create type public.image_upload_status as enum ('pending', 'ready', 'rejected');

create table public.image_uploads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  status public.image_upload_status not null default 'pending',
  -- R2 object keys: key_pending holds the unverified upload; key_final the cleaned WebP.
  key_pending text,
  key_final text,
  width integer,
  height integer,
  -- Neighborly rejection reason surfaced to the seller (never an error code).
  reason text,
  requested_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index image_uploads_store_status_idx
  on public.image_uploads (store_id, status, created_at desc);

create trigger image_uploads_set_updated_at
  before update on public.image_uploads
  for each row execute function public.set_updated_at();

alter table public.image_uploads enable row level security;

grant select, insert on public.image_uploads to authenticated;

-- Owner reads their own store's uploads (the client polls status here).
-- Ownership helpers live in the private schema since 0011 (public.is_store_owner was dropped).
create policy image_uploads_owner_select on public.image_uploads
  for select to authenticated using (private.is_store_owner(store_id));

-- The edge route inserts the initial pending row for a store the caller owns. It can only ever
-- create a row in the safe initial state — the container worker (service_role) owns the
-- ready/rejected transitions and the final key, so a seller can't self-declare a processed image.
create policy image_uploads_owner_insert on public.image_uploads
  for insert to authenticated with check (
    private.is_store_owner(store_id)
    and requested_by = auth.uid()
    and status = 'pending'
    and key_final is null
  );

-- No UPDATE/DELETE for authenticated: processing transitions are service_role only.
grant all on public.image_uploads to service_role;
