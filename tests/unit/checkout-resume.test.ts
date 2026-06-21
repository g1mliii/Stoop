import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createSecret: vi.fn(),
  from: vi.fn(),
  getStripe: vi.fn(),
  orderSelect: vi.fn(),
  tokenEq: vi.fn(),
  tokenGt: vi.fn(),
  tokenMaybeSingle: vi.fn(),
  tokenSelect: vi.fn()
}));

vi.mock("@/lib/supabase/secret", () => ({
  createSupabaseSecretClient: mocks.createSecret
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: mocks.getStripe
}));

vi.mock("@/lib/stripe/checkout", () => ({
  createOrderCheckoutSession: vi.fn()
}));

import { resumeCheckout } from "@/lib/actions/checkout";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tokenSelect.mockReturnValue({ eq: mocks.tokenEq });
  mocks.tokenEq.mockReturnValue({ gt: mocks.tokenGt });
  mocks.tokenGt.mockReturnValue({ maybeSingle: mocks.tokenMaybeSingle });
  mocks.from.mockImplementation((table: string) => {
    if (table === "order_tracking_tokens") {
      return { select: mocks.tokenSelect };
    }
    return { select: mocks.orderSelect };
  });
  mocks.createSecret.mockReturnValue({ from: mocks.from });
});

describe("resumeCheckout", () => {
  it("does not resume checkout for an expired tracking token", async () => {
    mocks.tokenMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(resumeCheckout("valid-token_123")).resolves.toEqual({
      ok: false,
      error: "We couldn't find that order."
    });

    expect(mocks.tokenGt).toHaveBeenCalledWith("expires_at", expect.any(String));
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("order_tracking_tokens");
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });
});
