import { beforeAll, describe, expect, it, vi } from "vitest";

// The cookie helper is marked "server-only"; stub the guard so it imports under vitest.
vi.mock("server-only", () => ({}));

import type { PendingSignup } from "@/lib/schemas/signup";
import {
  SIGNUP_COOKIE_TTL_SECONDS,
  signPendingSignup,
  verifyPendingSignup
} from "@/lib/utils/quickstart-cookie";

const basePayload = (): PendingSignup => ({
  storeName: "Priya's Kitchen",
  itemName: "Brown butter cookies",
  priceCents: 1200,
  pickupMethod: "message_after_order",
  issuedAt: Date.now()
});

beforeAll(() => {
  process.env.SIGNUP_COOKIE_SECRET = "test-secret-please-rotate-in-prod";
});

describe("quickstart cookie", () => {
  it("round-trips a signed payload", async () => {
    const payload = basePayload();
    const signed = await signPendingSignup(payload);
    expect(signed).toContain(".");
    await expect(verifyPendingSignup(signed)).resolves.toEqual(payload);
  });

  it("rejects a tampered body", async () => {
    const signed = await signPendingSignup(basePayload());
    const [body, sig] = signed.split(".");
    // Flip a character in the payload but keep the original signature.
    const forged = `${body}x.${sig}`;
    await expect(verifyPendingSignup(forged)).resolves.toBeNull();
  });

  it("rejects a wrong signature", async () => {
    const [body] = (await signPendingSignup(basePayload())).split(".");
    await expect(verifyPendingSignup(`${body}.not-a-real-signature`)).resolves.toBeNull();
  });

  it("rejects an expired payload", async () => {
    const stale = {
      ...basePayload(),
      issuedAt: Date.now() - (SIGNUP_COOKIE_TTL_SECONDS + 60) * 1000
    };
    const signed = await signPendingSignup(stale);
    await expect(verifyPendingSignup(signed)).resolves.toBeNull();
  });

  it("rejects malformed and empty values", async () => {
    await expect(verifyPendingSignup(undefined)).resolves.toBeNull();
    await expect(verifyPendingSignup("")).resolves.toBeNull();
    await expect(verifyPendingSignup("no-dot-here")).resolves.toBeNull();
  });

  it("does not verify under a different secret", async () => {
    const signed = await signPendingSignup(basePayload());
    process.env.SIGNUP_COOKIE_SECRET = "a-different-secret";
    try {
      await expect(verifyPendingSignup(signed)).resolves.toBeNull();
    } finally {
      process.env.SIGNUP_COOKIE_SECRET = "test-secret-please-rotate-in-prod";
    }
  });
});
