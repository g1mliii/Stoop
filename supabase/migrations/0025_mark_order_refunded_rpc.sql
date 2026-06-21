-- Phase 5.8: atomic refund-state transition for the charge.refunded webhook.
--
-- Marking an order refunded must (a) flip payment_status and (b) decrement the store's
-- order_count_week social-proof counter — together, once. supabase-js can't express an atomic
-- `set order_count_week = order_count_week - 1`, and the two updates must not drift if the webhook
-- redelivers, so this runs as one SECURITY DEFINER transaction. It is idempotent: a redelivery
-- finds payment_status already 'refunded', changes nothing, and returns null.
--
-- v1 is full-refund only (hard invariant), so any charge.refunded on the order moves it straight
-- to 'refunded'. Called server-side only via the secret/service-role client.

create or replace function public.mark_order_refunded(p_payment_intent_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_store_id uuid;
begin
  select o.id, o.store_id
    into v_order_id, v_store_id
  from public.orders o
  where o.stripe_payment_intent_id = p_payment_intent_id
    and o.payment_status is distinct from 'refunded'
  for update;

  if v_order_id is null then
    return null;
  end if;

  update public.orders
  set payment_status = 'refunded'
  where id = v_order_id;

  update public.stores
  set order_count_week = greatest(order_count_week - 1, 0)
  where id = v_store_id;

  return v_order_id;
end;
$$;

revoke all on function public.mark_order_refunded(text) from public, anon, authenticated;
grant execute on function public.mark_order_refunded(text) to service_role;
