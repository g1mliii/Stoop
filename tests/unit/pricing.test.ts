import { describe, expect, it } from "vitest";

import { computePlatformFee, formatBps, PLATFORM_FEE_BPS } from "@/lib/pricing/fee";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/pricing/currency";

describe("computePlatformFee", () => {
  it("is round(total * 3%) on boundary values", () => {
    expect(computePlatformFee(0)).toBe(0);
    expect(computePlatformFee(1)).toBe(0);
    expect(computePlatformFee(33)).toBe(1);
    expect(computePlatformFee(99)).toBe(3);
    expect(computePlatformFee(100)).toBe(3);
    expect(computePlatformFee(1234)).toBe(37);
    expect(computePlatformFee(99999)).toBe(3000);
  });

  it("returns an integer in [0, total_cents] for arbitrary non-negative input", () => {
    for (let i = 0; i < 5000; i++) {
      const total = Math.floor((i * 7919) % 5_000_000);
      const fee = computePlatformFee(total);
      expect(Number.isInteger(fee)).toBe(true);
      expect(fee).toBeGreaterThanOrEqual(0);
      expect(fee).toBeLessThanOrEqual(total);
    }
  });

  it("clamps junk / negative input to 0", () => {
    expect(computePlatformFee(-100)).toBe(0);
    expect(computePlatformFee(Number.NaN)).toBe(0);
  });
});

describe("formatBps", () => {
  it("renders whole percentages without decimals", () => {
    expect(formatBps(PLATFORM_FEE_BPS)).toBe("3%");
    expect(formatBps(300)).toBe("3%");
  });

  it("renders fractional percentages", () => {
    expect(formatBps(250)).toBe("2.5%");
    expect(formatBps(125)).toBe("1.25%");
  });
});

describe("formatMoney", () => {
  it("drops cents on whole dollars, shows two otherwise", () => {
    expect(formatMoney(1200)).toBe("$12");
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(1250)).toBe("$12.50");
    expect(formatMoney(1205)).toBe("$12.05");
  });

  it("is CAD-only in v1", () => {
    expect(DEFAULT_CURRENCY).toBe("cad");
    expect(formatMoney(500)).toBe("$5");
  });
});
