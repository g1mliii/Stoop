import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  createSecret: vi.fn(),
  from: vi.fn(),
  getStripe: vi.fn(),
  processStripeEvent: vi.fn(),
  requiredEnv: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  upsert: vi.fn()
}));

vi.mock("@/lib/env", () => ({
  requiredEnv: mocks.requiredEnv
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: mocks.getStripe
}));

vi.mock("@/lib/stripe/webhook-handlers", () => ({
  processStripeEvent: mocks.processStripeEvent
}));

vi.mock("@/lib/supabase/secret", () => ({
  createSupabaseSecretClient: mocks.createSecret
}));

import { POST } from "@/app/api/stripe/webhook/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requiredEnv.mockReturnValue("whsec_test");
  mocks.constructEvent.mockReturnValue({
    data: { object: {} },
    id: "evt_test",
    type: "checkout.session.completed"
  });
  mocks.getStripe.mockReturnValue({
    webhooks: { constructEvent: mocks.constructEvent }
  });
  mocks.from.mockReturnValue({
    select: mocks.select,
    upsert: mocks.upsert
  });
  mocks.createSecret.mockReturnValue({ from: mocks.from, rpc: mocks.rpc });
});

describe("Stripe webhook route", () => {
  it("fails closed and does not process when the durable inbox write fails", async () => {
    mocks.upsert.mockResolvedValue({ error: { message: "database unavailable" } });

    const response = await POST(
      new Request("https://stoop.test/api/stripe/webhook", {
        body: "signed body",
        headers: { "stripe-signature": "sig_test" },
        method: "POST"
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "webhook inbox unavailable" });
    expect(mocks.processStripeEvent).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("acknowledges an already-claimed event without processing it twice", async () => {
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    const response = await POST(
      new Request("https://stoop.test/api/stripe/webhook", {
        body: "signed body",
        headers: { "stripe-signature": "sig_test" },
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_stripe_event", {
      p_stripe_event_id: "evt_test"
    });
    expect(mocks.processStripeEvent).not.toHaveBeenCalled();
  });
});
