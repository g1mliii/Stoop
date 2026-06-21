-- Phase 5.8 (follow-up): make the refund transition link by order id and write its audit row
-- atomically.
--
-- Two fixes over 0025:
--  1. Link by p_order_id (resolved from the durable metadata.order_id on the PaymentIntent) instead
--     of stripe_payment_intent_id. That column is only populated by checkout.session.completed, so a
--     charge.refunded delivered out of order found no row and silently dropped the refund.
--  2. Fold the audit_log insert into this transaction. Previously the webhook flipped the status via
--     the RPC, then wrote the audit row separately — if that write failed, the redelivery found the
--     order already 'refunded', returned null, and the audit row was lost forever. Now the flip,
--     the order_count_week decrement, and the audit row commit together, once.
--
-- Still idempotent: a redelivery finds payment_status already 'refunded', changes nothing, returns
-- null. v1 is full-refund only. Called server-side only via the secret/service-role client.

drop function if exists public.mark_order_refunded(text);

create or replace function public.mark_order_refunded(
  p_order_id uuid,
  p_charge_id text,
  p_amount_refunded bigint
)
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
  where o.id = p_order_id
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

  insert into public.audit_log (actor_type, action, target_table, target_id, payload_jsonb)
  values (
    'system',
    'order.refunded',
    'orders',
    v_order_id::text,
    jsonb_build_object('stripe_charge_id', p_charge_id, 'amount_refunded', p_amount_refunded)
  );

  return v_order_id;
end;
$$;

revoke all on function public.mark_order_refunded(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.mark_order_refunded(uuid, text, bigint) to service_role;
