import { describe, expect, it } from "vitest";

import { formatMoney } from "@/lib/pricing/currency";
import { parsePriceToCents } from "@/lib/utils/price";

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

  it("round-trips through formatMoney", () => {
    for (const input of ["$8", "8.99", "100", "0.05"]) {
      const cents = parsePriceToCents(input);
      expect(parsePriceToCents(formatMoney(cents))).toBe(cents);
    }
  });
});
