-- Phase 5 scale follow-up: match the new Money/refund hot paths and serialize Stripe webhook
-- processing per event id. Forward-only for environments that already applied 0024-0026.

-- Money screen: last-five refunds for a seller's store(s), ordered by refund timestamp
-- (`updated_at` is stamped by the refund RPC's order update).
create index if not exists orders_store_refunded_updated_idx
  on public.orders (store_id, updated_at desc)
  where payment_status = 'refunded';

-- Stripe webhook inbox claim lease. `stripe_event_id` still dedupes persistence; this column
-- prevents duplicate/retry deliveries from running side effects in parallel while allowing a
-- crashed processor to be reclaimed after a short stale window.
alter table public.stripe_events
  add column if not exists processing_started_at timestamptz;

create index if not exists stripe_events_processing_started_idx
  on public.stripe_events (processing_started_at)
  where processed_at is null and processing_started_at is not null;

create or replace function public.claim_stripe_event(
  p_stripe_event_id text,
  p_stale_after_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  update public.stripe_events
  set
    processing_started_at = now(),
    attempts = attempts + 1,
    error = null
  where stripe_event_id = p_stripe_event_id
    and processed_at is null
    and (
      processing_started_at is null
      or processing_started_at < now() - (greatest(p_stale_after_seconds, 1) * interval '1 second')
    );

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.claim_stripe_event(text, integer) from public, anon, authenticated;
grant execute on function public.claim_stripe_event(text, integer) to service_role;
