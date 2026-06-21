"use server";

import { z } from "zod";

import { createOrderCheckoutSession, type CheckoutResult } from "@/lib/stripe/checkout";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseSecretClient } from "@/lib/supabase/secret";

// Phase 5.5a: resume checkout for an unpaid online order. Stripe Checkout Sessions expire 24h
// after creation, so a customer returning via the tracking page's "Pay now" link must get a live
// session — reusing the open one if it's still valid, or minting a fresh one (with a new
// idempotency-key suffix) if the old one expired. This is the fix for the silent dead-end where a
// returning customer hits an expired Stripe URL and the order is stuck unpaid forever.

// Tracking tokens are URL-safe base64 capability handles (see generateToken), never UUIDs.
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export async function resumeCheckout(token: string): Promise<CheckoutResult> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) {
    return { ok: false, error: "We couldn't find that order." };
  }

  const supabase = createSupabaseSecretClient();

  const { data: tokenRow } = await supabase
    .from("order_tracking_tokens")
    .select("order_id")
    .eq("token", parsed.data)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!tokenRow) {
    return { ok: false, error: "We couldn't find that order." };
  }

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, payment_mode, payment_status, stripe_checkout_session_id, checkout_retry_count"
    )
    .eq("id", tokenRow.order_id)
    .single();
  if (!order) {
    return { ok: false, error: "We couldn't find that order." };
  }
  // 'failed' (a declined earlier attempt) is recoverable just like 'unpaid' — both are pre-payment.
  if (
    order.payment_mode !== "online" ||
    (order.payment_status !== "unpaid" && order.payment_status !== "failed")
  ) {
    return { ok: false, error: "This order doesn't need a payment." };
  }

  // Reuse the existing session if it's still open (don't mint a duplicate / risk a second charge).
  if (order.stripe_checkout_session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(
        order.stripe_checkout_session_id
      );
      if (session.status === "open" && session.url) {
        return { ok: true, url: session.url };
      }
      if (session.payment_status === "paid") {
        // Webhook just hasn't landed yet; don't create a second charge.
        return { ok: false, error: "Looks like this is already paid — refresh in a moment." };
      }
    } catch {
      // Fall through to minting a new session.
    }
  }

  // Mint a fresh session. Every minting path bumps the attempt counter — it's the idempotency-key
  // suffix, so reusing it (e.g. on the no-session path) would make Stripe replay the old/expired
  // session instead of a live one. Persist the bump so the next retry stays unique.
  const nextAttempt = order.checkout_retry_count + 1;
  const result = await createOrderCheckoutSession({
    orderId: order.id,
    token,
    attempt: nextAttempt
  });
  if (result.ok) {
    await supabase
      .from("orders")
      .update({ checkout_retry_count: nextAttempt })
      .eq("id", order.id);
  }
  return result;
}
