import "server-only";

import * as Sentry from "@sentry/nextjs";

import { appBaseUrl, optionalEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send-email";
import {
  buildCustomerPaidEmail,
  buildCustomerPaymentFailedEmail,
  buildSellerPaidEmail
} from "@/lib/email/templates/payment-confirmation";
import { orderRefFrom } from "@/lib/orders/pickup";
import { createSupabaseSecretClient } from "@/lib/supabase/secret";

// Phase 5.6/5.9: post-payment emails, sent from the webhook handlers after Stripe confirms (or
// declines) a charge. The tracking token is fetched here so callers only need the order id.

async function loadOrderForEmail(orderId: string) {
  const supabase = createSupabaseSecretClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_name, customer_email, total_cents, pickup_window, store_id")
    .eq("id", orderId)
    .single();
  if (!order) return null;

  const [{ data: store }, { data: tokenRow }] = await Promise.all([
    supabase.from("stores").select("name, slug, seller_id").eq("id", order.store_id).single(),
    supabase
      .from("order_tracking_tokens")
      .select("token")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);
  if (!store || !tokenRow) return null;

  const { data: seller } = await supabase
    .from("sellers")
    .select("contact_email")
    .eq("id", store.seller_id)
    .single();

  return { order, store, token: tokenRow.token, sellerEmail: seller?.contact_email ?? null };
}

/** Sent on checkout.session.completed: customer "paid up" + seller "order paid". */
export async function sendPaymentConfirmationEmails(orderId: string): Promise<void> {
  const loaded = await loadOrderForEmail(orderId);
  if (!loaded) return;

  const { order, store, token, sellerEmail } = loaded;
  const footerAddress = optionalEnv("STOOP_MAILING_ADDRESS");
  const base = appBaseUrl();

  const customerEmail = buildCustomerPaidEmail({
    storeName: store.name,
    totalCents: order.total_cents,
    trackingUrl: `${base}/o/${token}`,
    pickupWindow: order.pickup_window,
    footerAddress
  });

  const sends: Promise<unknown>[] = [
    sendEmail({ to: order.customer_email, ...customerEmail })
  ];

  if (sellerEmail) {
    const sellerMessage = buildSellerPaidEmail({
      storeName: store.name,
      orderRef: orderRefFrom(order.id),
      totalCents: order.total_cents,
      dashboardUrl: `${base}/dashboard/orders`,
      footerAddress
    });
    sends.push(sendEmail({ to: sellerEmail, ...sellerMessage }));
  }

  // allSettled, not all: a failed seller send must not suppress a successful customer send (and
  // vice versa). Each recipient is independent; report failures to Sentry without throwing.
  const results = await Promise.allSettled(sends);
  for (const result of results) {
    if (result.status === "rejected") {
      Sentry.captureException(result.reason);
    }
  }
}

/** Sent on payment_intent.payment_failed: customer retry link back to the order page. */
export async function sendPaymentFailedEmail(orderId: string): Promise<void> {
  const loaded = await loadOrderForEmail(orderId);
  if (!loaded) return;

  const { order, store, token } = loaded;
  const message = buildCustomerPaymentFailedEmail({
    storeName: store.name,
    totalCents: order.total_cents,
    trackingUrl: `${appBaseUrl()}/o/${token}`,
    footerAddress: optionalEnv("STOOP_MAILING_ADDRESS")
  });
  await sendEmail({ to: order.customer_email, ...message });
}
