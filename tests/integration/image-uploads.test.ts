import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  authedClient,
  cleanupUser,
  seedSeller,
  serviceClient,
  type Db,
  type SeededSeller
} from "./helpers/clients";

// Phase 3.5 RLS regression for image_uploads. Requires migration 0016 applied.
// The container-side checks (reject svg / animated / oversized re-encode) live in the
// image-processor container and are covered by that service, not the RLS suite.

const service = serviceClient();

let sellerA: SeededSeller;
let sellerB: SeededSeller;
let clientA: Db;
let clientB: Db;

beforeAll(async () => {
  sellerA = await seedSeller(service, { slug: `imga-${Date.now()}` });
  sellerB = await seedSeller(service, { slug: `imgb-${Date.now()}` });
  clientA = await authedClient(sellerA.email, sellerA.password);
  clientB = await authedClient(sellerB.email, sellerB.password);
});

afterAll(async () => {
  await cleanupUser(service, sellerA.userId);
  await cleanupUser(service, sellerB.userId);
});

describe("image_uploads RLS", () => {
  it("owner can insert a pending row for their own store", async () => {
    const { error } = await clientA.from("image_uploads").insert({
      store_id: sellerA.storeId,
      key_pending: `uploads/pending/${sellerA.storeId}/x`,
      requested_by: sellerA.userId,
      status: "pending"
    });
    expect(error).toBeNull();
  });

  it("rejects self-declaring a ready row", async () => {
    const { error } = await clientA.from("image_uploads").insert({
      store_id: sellerA.storeId,
      key_pending: `uploads/pending/${sellerA.storeId}/y`,
      key_final: `uploads/${sellerA.storeId}/y.webp`,
      requested_by: sellerA.userId,
      status: "ready"
    });
    expect(error).not.toBeNull();
  });

  it("rejects inserting against another seller's store", async () => {
    const { error } = await clientA.from("image_uploads").insert({
      store_id: sellerB.storeId,
      key_pending: `uploads/pending/${sellerB.storeId}/z`,
      requested_by: sellerA.userId,
      status: "pending"
    });
    expect(error).not.toBeNull();
  });

  it("does not leak another seller's uploads on select", async () => {
    // Seed an upload for B via the service role.
    await service.from("image_uploads").insert({
      store_id: sellerB.storeId,
      key_pending: `uploads/pending/${sellerB.storeId}/seed`,
      requested_by: sellerB.userId,
      status: "pending"
    });

    const { data: aSeesB } = await clientA
      .from("image_uploads")
      .select("id")
      .eq("store_id", sellerB.storeId);
    expect(aSeesB ?? []).toHaveLength(0);

    const { data: bSeesOwn } = await clientB
      .from("image_uploads")
      .select("id")
      .eq("store_id", sellerB.storeId);
    expect((bSeesOwn ?? []).length).toBeGreaterThan(0);
  });
});
