"use server";

import { fieldErrorsFrom } from "@/lib/schemas/field-errors";
import { orderPlacementSchema } from "@/lib/schemas/order";
import { sendOrderConfirmationEmails } from "@/lib/email/order-confirmation";
import { orderRequestHash } from "@/lib/orders/request-hash";
import { createOrderCheckoutSession } from "@/lib/stripe/checkout";
import { getConnectedAccount } from "@/lib/stripe/connected-account";
import { createSupabaseSecretClient } from "@/lib/supabase/secret";
import { generateToken } from "@/lib/utils/token";

// Phase 4.4: customer order placement. The whole insert (orders + order_items +
// order_tracking_tokens + order_count_week bump) happens inside the place_order RPC
// (migration 0020), which runs SECURITY DEFINER so the multi-table write and the
// server-side price recompute don't depend on anon's narrow INSERT grants. We call it
// with the secret/service-role client — never the anon client.

// Tracking links stay useful well past pickup but not forever.
const TOKEN_TTL_HOURS = 24 * 30;

export type PlaceOrderResult =
  | { ok: true; clearCart: true; token: string }
  | { ok: true; clearCart: true; redirectUrl: string }
  | { ok: false; fieldErrors?: Record<string, string>; error?: string };

export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  const parsed = orderPlacementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  const order = parsed.data;

  const supabase = createSupabaseSecretClient();
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("is_active, accept_pay_at_pickup, seller_id")
    .eq("id", order.storeId)
    .maybeSingle();
  if (storeError) {
    return { ok: false, error: "We couldn't place your order. Try again in a moment." };
  }
  if (!store?.is_active) {
    return { ok: false, error: "This stoop isn't taking orders right now." };
  }
  if (order.paymentMode === "pay_at_pickup") {
    if (!store.accept_pay_at_pickup) {
      return {
        ok: false,
        error: "This stoop isn't taking pay-at-pickup orders right now."
      };
    }
  } else {
    // Online needs the seller's Stripe Connect account to take charges. The place_order RPC and
    // the orders trigger enforce this in SQL too (STP06); checking here gives a kinder message and
    // avoids minting a token for an order that can't proceed.
    const connected = await getConnectedAccount(store.seller_id);
    if (!connected?.charges_enabled) {
      return {
        ok: false,
        error: "Online payment isn't set up for this stoop yet. Choose pay at pickup."
      };
    }
  }

  const requestHash = await orderRequestHash(order);
  // Minted here so the generator stays single-source; the RPC keeps it only on a fresh
  // insert and returns the order's stored token on a legitimate replay.
  const candidateToken = generateToken();

  const { data, error } = await supabase.rpc("place_order", {
    p_store_id: order.storeId,
    p_customer_name: order.customerName,
    p_customer_email: order.customerEmail,
    p_customer_phone_e164: order.customerPhoneE164 ?? null,
    p_payment_mode: order.paymentMode,
    p_pickup_window: order.pickupWindow ?? null,
    p_notes: order.notes ?? null,
    p_idempotency_key: order.idempotencyKey,
    p_request_hash: requestHash,
    p_token: candidateToken,
    p_token_ttl_hours: TOKEN_TTL_HOURS,
    p_items: order.items.map((i) => ({ product_id: i.productId, quantity: i.quantity }))
  });

  if (error) {
    // STP01: same idempotency key, different body. Refuse without leaking the first token.
    if (error.code === "STP01") {
      return {
        ok: false,
        error: "This order can't be placed again — refresh the page and start over."
      };
    }
    if (error.code === "STP04" || error.code === "STP05") {
      return {
        ok: false,
        error: "Something in your cart just sold out or changed. Refresh and try again."
      };
    }
    if (error.code === "STP02") {
      return { ok: false, error: "This stoop isn't taking orders right now." };
    }
    if (error.code === "STP06") {
      return {
        ok: false,
        error: "This stoop isn't taking that payment method right now."
      };
    }
    return { ok: false, error: "We couldn't place your order. Try again in a moment." };
  }

  const row = data?.[0];
  if (!row?.token) {
    return { ok: false, error: "We couldn't place your order. Try again in a moment." };
  }

  if (order.paymentMode === "online") {
    // Online orders start 'unpaid'; the customer pays through Stripe-hosted Checkout and the
    // webhook (5.6) flips the order to 'paid'. The paid-confirmation email is sent then, not now.
    // A replay (double-tap) reuses the same idempotency key, so Stripe returns the existing
    // session — the customer lands back on the same checkout URL.
    const checkout = await createOrderCheckoutSession({
      orderId: row.order_id,
      token: row.token,
      attempt: 0
    });
    if (checkout.ok) {
      return { ok: true, clearCart: true, redirectUrl: checkout.url };
    }
    // The order exists but we couldn't start checkout. Send them to the tracking page, where
    // "Pay now" (5.5a) can retry rather than dead-ending.
    return { ok: true, clearCart: true, token: row.token };
  }

  // Pay-at-pickup: confirmation emails are best-effort — a delivery hiccup must not fail a placed
  // order. Skip on a replay so a double-tap doesn't double-send.
  if (!row.replayed) {
    try {
      await sendOrderConfirmationEmails({ orderId: row.order_id, token: row.token });
    } catch {
      // Swallow — the order exists; the seller still sees it in the dashboard.
    }
  }

  return { ok: true, clearCart: true, token: row.token };
}
