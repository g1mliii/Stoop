import { emailFooter as footer, escapeHtml } from "@/lib/email/html";
import { formatMoney } from "@/lib/pricing/currency";

// Phase 5.6/5.9 email templates. Kit voice: sentence case, second-person, plain copy, no emoji,
// no error codes. Money figures stay in a monospace span. Transactional, so no unsubscribe link,
// but they carry the same physical-address footer as the order-confirmation templates.

type PaidCustomerArgs = {
  storeName: string;
  totalCents: number;
  trackingUrl: string;
  pickupWindow: string | null;
  footerAddress?: string;
};

export function buildCustomerPaidEmail(args: PaidCustomerArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const f = footer(args.footerAddress);
  const pickup = args.pickupWindow ? `Pickup: ${args.pickupWindow}` : null;

  const text = [
    `You're paid up.`,
    `Your payment of ${formatMoney(args.totalCents)} to ${args.storeName} went through. We'll email you when it's ready for pickup.`,
    pickup,
    ``,
    `Track your order: ${args.trackingUrl}`,
    ``,
    f.text
  ]
    .filter((l) => l !== null)
    .join("\n");

  const html = [
    `<p style="font-size:18px;">You're paid up.</p>`,
    `<p>Your payment of <span style="font-family:monospace;">${formatMoney(
      args.totalCents
    )}</span> to ${escapeHtml(
      args.storeName
    )} went through. We'll email you when it's ready for pickup.</p>`,
    pickup ? `<p>${escapeHtml(pickup)}</p>` : "",
    `<p><a href="${args.trackingUrl}">Track your order</a></p>`,
    f.html
  ]
    .filter(Boolean)
    .join("");

  return { subject: `Your payment to ${args.storeName} went through`, html, text };
}

type PaidSellerArgs = {
  storeName: string;
  orderRef: string;
  totalCents: number;
  dashboardUrl: string;
  footerAddress?: string;
};

export function buildSellerPaidEmail(args: PaidSellerArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const f = footer(args.footerAddress);

  // Voice cheat sheet: "Order #2014 paid. $24.00 in tomorrow's payout." Payout cadence is the
  // seller's Stripe schedule, so we keep it to "your next payout" rather than a hard date.
  const headline = `Order ${args.orderRef} paid. ${formatMoney(
    args.totalCents
  )} in your next payout.`;

  const text = [headline, ``, `Open it in your dashboard: ${args.dashboardUrl}`, ``, f.text].join(
    "\n"
  );

  const html = [
    `<p style="font-size:18px;">${escapeHtml(headline)}</p>`,
    `<p><a href="${args.dashboardUrl}">Open it in your dashboard</a></p>`,
    f.html
  ].join("");

  return { subject: `${args.orderRef} paid at ${args.storeName}`, html, text };
}

type FailedCustomerArgs = {
  storeName: string;
  totalCents: number;
  trackingUrl: string;
  footerAddress?: string;
};

export function buildCustomerPaymentFailedEmail(args: FailedCustomerArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const f = footer(args.footerAddress);

  const text = [
    `Your payment didn't go through.`,
    `The card for your ${formatMoney(args.totalCents)} order at ${args.storeName} was declined, so the order isn't placed yet. You can try again from your order page.`,
    ``,
    `Pay now: ${args.trackingUrl}`,
    ``,
    f.text
  ].join("\n");

  const html = [
    `<p style="font-size:18px;">Your payment didn't go through.</p>`,
    `<p>The card for your <span style="font-family:monospace;">${formatMoney(
      args.totalCents
    )}</span> order at ${escapeHtml(
      args.storeName
    )} was declined, so the order isn't placed yet. You can try again from your order page.</p>`,
    `<p><a href="${args.trackingUrl}">Pay now</a></p>`,
    f.html
  ].join("");

  return { subject: `Finish your order at ${args.storeName}`, html, text };
}
