-- Security-scan follow-up. These changes are intentionally forward-only: existing migrations are
-- immutable once applied, while this migration removes direct-write paths that bypass server checks.

-- Seller-authenticated clients may edit only the two seller-authored notes. Payment, Checkout, and
-- lifecycle state are changed by narrowly scoped server-side RPCs or verified Stripe webhooks.
revoke update on public.orders from authenticated;
grant update (notes_seller, notes_shared) on public.orders to authenticated;

-- Building memberships are derived from a store's normalized address and visibility by the
-- service-role grouping RPC. Letting a seller PATCH their own row lets them forge another building.
revoke update on public.building_memberships from authenticated;
drop policy if exists building_memberships_owner_update on public.building_memberships;

-- Public subscriber inserts must remain email-shaped even when callers bypass the Next.js Zod
-- schema. The formula-prefix guard also protects future exports from spreadsheet formula injection.
alter table public.subscribers
  add constraint subscribers_email_safe_format_check
  check (
    email = btrim(email)
    and char_length(email) between 3 and 254
    and email !~ '^[=+@-]'
    and email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ) not valid;

-- Scan attribution is a fixed taxonomy. Enforcing the same bound in Postgres prevents future
-- service code from reintroducing unbounded public aggregate-row cardinality.
alter table public.scan_event_daily
  add constraint scan_event_daily_src_allowed_check
  check (src in ('direct', 'instagram', 'whatsapp', 'poster', 'qr')) not valid;
