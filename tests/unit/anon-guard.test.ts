import { beforeEach, describe, expect, it, vi } from "vitest";

import type { KVNamespace, RateLimitReservation } from "@/lib/ratelimit/kv";
import type { AnonWriteWindows } from "@/lib/ratelimit/anon-guard";
import type * as RateLimitKvModule from "@/lib/ratelimit/kv";

import { fakeKv } from "./fake-kv";

const mocks = vi.hoisted(() => ({
  clientIp: vi.fn<() => Promise<string>>(),
  kv: null as KVNamespace | null,
  verifyTurnstile: vi.fn<() => Promise<boolean>>()
}));

vi.mock("@/lib/security/request-ip", () => ({
  clientIp: mocks.clientIp
}));

vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstile: mocks.verifyTurnstile
}));

vi.mock("@/lib/ratelimit/kv", async (importOriginal) => {
  const actual = await importOriginal<typeof RateLimitKvModule>();
  return {
    ...actual,
    getRateLimitKv: () => mocks.kv
  };
});

const { guardAnonWrite } = await import("@/lib/ratelimit/anon-guard");

function windows(
  ip: string,
  preTurnstileLimit = 1,
  postTurnstileLimit = 1
): AnonWriteWindows {
  const preTurnstile: RateLimitReservation[] = [
    {
      key: `order:ip:${ip}:store-a`,
      amount: 1,
      limit: preTurnstileLimit,
      windowSeconds: 60
    }
  ];
  const postTurnstile: RateLimitReservation[] = [
    {
      key: "order:store:store-a",
      amount: 1,
      limit: postTurnstileLimit,
      windowSeconds: 60
    }
  ];

  return { preTurnstile, postTurnstile };
}

describe("guardAnonWrite", () => {
  beforeEach(() => {
    mocks.clientIp.mockResolvedValue("1.2.3.4");
    mocks.kv = fakeKv();
    mocks.verifyTurnstile.mockResolvedValue(true);
  });

  it("sheds traffic over the IP limit before calling Turnstile", async () => {
    expect(await guardAnonWrite("tok", (ip) => windows(ip))).toEqual({ ok: true });
    expect(mocks.verifyTurnstile).toHaveBeenCalledTimes(1);

    mocks.verifyTurnstile.mockClear();
    await expect(guardAnonWrite("tok", (ip) => windows(ip))).resolves.toEqual({
      ok: false,
      reason: "rate_limit"
    });
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("does not reserve store capacity for a failed Turnstile challenge", async () => {
    mocks.verifyTurnstile.mockResolvedValue(false);

    await expect(guardAnonWrite("bad-token", (ip) => windows(ip, 2))).resolves.toEqual({
      ok: false,
      reason: "turnstile"
    });

    mocks.verifyTurnstile.mockResolvedValue(true);
    await expect(guardAnonWrite("good-token", (ip) => windows(ip, 2))).resolves.toEqual({
      ok: true
    });

    await expect(guardAnonWrite("second-token", (ip) => windows(ip, 3))).resolves.toEqual({
      ok: false,
      reason: "rate_limit"
    });
  });
});
