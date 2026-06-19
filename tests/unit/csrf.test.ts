import { describe, expect, it, vi } from "vitest";

import {
  isTrustedMutationRequest,
  STOOP_MUTATION_HEADER,
  STOOP_MUTATION_HEADER_VALUE
} from "@/lib/security/csrf";

function uploadRequest({
  header = STOOP_MUTATION_HEADER_VALUE,
  origin = "https://stoop.app",
  url = "https://stoop.app/api/upload"
}: {
  header?: string | null;
  origin?: string | null;
  url?: string;
} = {}): Request {
  const headers = new Headers();
  if (origin) {
    headers.set("origin", origin);
  }
  if (header) {
    headers.set(STOOP_MUTATION_HEADER, header);
  }
  return new Request(url, { headers, method: "POST" });
}

describe("isTrustedMutationRequest", () => {
  it("accepts same-origin dashboard mutations with the Stoop header", () => {
    expect(isTrustedMutationRequest(uploadRequest())).toBe(true);
  });

  it("accepts the configured app origin behind a worker URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stoop.app");
    expect(
      isTrustedMutationRequest(
        uploadRequest({
          origin: "https://stoop.app",
          url: "https://aptbazaar-preview.workers.dev/api/upload"
        })
      )
    ).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejects cross-origin or missing-header mutations", () => {
    expect(
      isTrustedMutationRequest(uploadRequest({ origin: "https://example.com" }))
    ).toBe(false);
    expect(isTrustedMutationRequest(uploadRequest({ header: null }))).toBe(false);
  });
});
