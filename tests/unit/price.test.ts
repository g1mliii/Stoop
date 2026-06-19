import { describe, expect, it } from "vitest";

import { formatPriceCents, parsePriceToCents } from "@/lib/utils/price";

describe("formatPriceCents", () => {
  it("drops cents on whole dollars", () => {
    expect(formatPriceCents(1200)).toBe("$12");
    expect(formatPriceCents(0)).toBe("$0");
  });

  it("shows two decimals otherwise", () => {
    expect(formatPriceCents(1250)).toBe("$12.50");
    expect(formatPriceCents(1205)).toBe("$12.05");
  });
});

describe("parsePriceToCents", () => {
  it("parses common inputs to cents", () => {
    expect(parsePriceToCents("$12")).toBe(1200);
    expect(parsePriceToCents("12.5")).toBe(1250);
    expect(parsePriceToCents("12.50")).toBe(1250);
    expect(parsePriceToCents("$1,2.34")).toBe(1234);
  });

  it("returns 0 for junk", () => {
    expect(parsePriceToCents("")).toBe(0);
    expect(parsePriceToCents("free")).toBe(0);
  });

  it("round-trips through formatPriceCents", () => {
    for (const input of ["$8", "8.99", "100", "0.05"]) {
      const cents = parsePriceToCents(input);
      expect(parsePriceToCents(formatPriceCents(cents))).toBe(cents);
    }
  });
});
