import { describe, expect, it, vi } from "vitest";

// store-name.ts is marked "server-only" (the obscenity dataset has no place in the client
// bundle); stub the guard so it imports under vitest.
vi.mock("server-only", () => ({}));

import { screenStoreName } from "@/lib/security/store-name";

describe("screenStoreName", () => {
  it("allows ordinary store names", () => {
    for (const name of [
      "Sunny's Sourdough",
      "The Candle Corner",
      "Maple & Thyme",
      "4B Crochet Co"
    ]) {
      expect(screenStoreName(name).action).toBe("allow");
    }
  });

  it("blocks obvious obscenity", () => {
    expect(screenStoreName("fucking bakery").action).toBe("block");
  });

  it("sees through common obfuscation", () => {
    // Leetspeak and punctuation-broken spellings should still block, not slip to allow.
    for (const name of ["sh1t shop", "f.u.c.k cakes", "f u c k bread"]) {
      expect(screenStoreName(name).action).toBe("block");
    }
  });

  it("does not false-positive on names that merely contain a substring (Scunthorpe)", () => {
    for (const name of ["Scunthorpe Bakes", "Cockburn Candles", "Assemble Crafts"]) {
      expect(screenStoreName(name).action).toBe("allow");
    }
  });

  it("flags brand impersonation without blocking", () => {
    const result = screenStoreName("Stoop Support");
    expect(result.action).toBe("flag");
    expect(result.terms.length).toBeGreaterThan(0);
  });

  it("flags regulated-category terms for review", () => {
    expect(screenStoreName("Green Weed Co").action).toBe("flag");
    expect(screenStoreName("Corner Casino").action).toBe("flag");
  });

  it("matches the watchlist on whole words only", () => {
    // "tweed" contains "weed" but is not a regulated term.
    expect(screenStoreName("Tweed & Wool").action).toBe("allow");
  });
});
