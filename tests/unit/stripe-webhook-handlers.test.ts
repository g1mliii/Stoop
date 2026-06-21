import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  accountFlags: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  createSecret: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  getConnectedAccountByStripeId: vi.fn(),
  getStripe: vi.fn(),
  inFilter: vi.fn(),
  persistAccountFlags: vi.fn(),
  retrievePaymentIntent: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  sendPaymentConfirmationEmails: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  update: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage
}));

vi.mock("@/lib/audit/log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

vi.mock("@/lib/email/payment-confirmation", () => ({
  sendPaymentConfirmationEmails: mocks.sendPaymentConfirmationEmails,
  sendPaymentFailedEmail: mocks.sendPaymentFailedEmail
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: mocks.getStripe
}));

vi.mock("@/lib/stripe/connected-account", () => ({
  accountFlags: mocks.accountFlags,
  getConnectedAccountByStripeId: mocks.getConnectedAccountByStripeId,
  persistAccountFlags: mocks.persistAccountFlags
}));

vi.mock("@/lib/supabase/secret", () => ({
  createSupabaseSecretClient: mocks.createSecret
}));

import { processStripeEvent } from "@/lib/stripe/webhook-handlers";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function stripeEvent(type: string, object: Record<string, unknown>) {
  return { data: { object }, id: `evt_${type}`, type } as never;
}

beforeEach(() => {
  vi.clearAllMocks();

  const query = {
    eq: mocks.eq,
    in: mocks.inFilter,
    select: mocks.select
  };
  mocks.update.mockReturnValue(query);
  mocks.inFilter.mockReturnValue(query);
  mocks.eq.mockReturnValue(query);
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.createSecret.mockReturnValue({
    from: mocks.from,
    rpc: mocks.rpc
  });
  mocks.select.mockResolvedValue({ data: [], error: null });
  mocks.rpc.mockResolvedValue({ data: ORDER_ID, error: null });
  mocks.writeAuditLog.mockResolvedValue(undefined);
  mocks.getStripe.mockReturnValue({
    paymentIntents: { retrieve: mocks.retrievePaymentIntent }
  });
});

describe("processStripeEvent", () => {
  it("throws when a checkout completion cannot update the order", async () => {
    mocks.select.mockResolvedValueOnce({
      data: null,
      error: { message: "orders table unavailable" }
    });

    await expect(
      processStripeEvent(
        stripeEvent("checkout.session.completed", {
          id: "cs_test",
          metadata: { order_id: ORDER_ID },
          payment_intent: "pi_test",
          payment_status: "paid"
        })
      )
    ).rejects.toThrow("orders paid update failed: orders table unavailable");

    expect(mocks.sendPaymentConfirmationEmails).not.toHaveBeenCalled();
  });

  it("throws when a payment failure cannot update the order", async () => {
    mocks.select.mockResolvedValueOnce({
      data: null,
      error: { message: "orders table unavailable" }
    });

    await expect(
      processStripeEvent(
        stripeEvent("payment_intent.payment_failed", {
          id: "pi_test",
          metadata: { order_id: ORDER_ID }
        })
      )
    ).rejects.toThrow("orders failed update failed: orders table unavailable");

    expect(mocks.sendPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it("does not mark an order refunded for a partial Stripe refund", async () => {
    await expect(
      processStripeEvent(
        stripeEvent("charge.refunded", {
          amount: 600,
          amount_refunded: 200,
          id: "ch_partial",
          metadata: { order_id: ORDER_ID },
          payment_intent: "pi_test",
          refunded: false
        })
      )
    ).resolves.toBeUndefined();

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith({
      actorType: "system",
      action: "order.partial_refund_observed",
      targetTable: "orders",
      targetId: ORDER_ID,
      payload: {
        amount: 600,
        amount_refunded: 200,
        stripe_charge_id: "ch_partial"
      }
    });
  });

  it("throws when a full-refund RPC fails", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "rpc unavailable" }
    });

    await expect(
      processStripeEvent(
        stripeEvent("charge.refunded", {
          amount: 600,
          amount_refunded: 600,
          id: "ch_full",
          metadata: { order_id: ORDER_ID },
          payment_intent: "pi_test",
          refunded: true
        })
      )
    ).rejects.toThrow("mark_order_refunded failed: rpc unavailable");

    expect(mocks.rpc).toHaveBeenCalledWith("mark_order_refunded", {
      p_order_id: ORDER_ID,
      p_charge_id: "ch_full",
      p_amount_refunded: 600
    });
  });
});
