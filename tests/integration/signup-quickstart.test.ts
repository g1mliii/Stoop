import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { authedClient, serviceClient } from "./helpers/clients";
import { generateToken } from "@/lib/utils/token";

// Phase 3.2 regression: create_store_quickstart is atomic and guards against duplicate tenants.
// Requires migration 0015 applied to the target project.

const service = serviceClient();

let userId: string;
let email: string;
const extraUserIds: string[] = [];

beforeAll(async () => {
  const tag = `${Date.now()}-${generateToken().slice(0, 6)}`;
  email = `quickstart-${tag}@example.test`;
  const password = `pw-${generateToken()}`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message}`);
  }
  userId = data.user.id;
});

afterAll(async () => {
  if (userId) {
    await service.auth.admin.deleteUser(userId);
  }
  await Promise.all(extraUserIds.map((id) => service.auth.admin.deleteUser(id)));
});

describe("create_store_quickstart", () => {
  it("creates exactly one seller, store, and product, with system defaults and no building membership", async () => {
    const { data, error } = await service.rpc("create_store_quickstart", {
      p_user_id: userId,
      p_display_name: "Priya",
      p_contact_email: email,
      p_store_name: "Priya's Kitchen",
      p_slug_base: `priyas-kitchen-${Date.now()}`,
      p_item_name: "Brown butter cookies",
      p_price_cents: 1200,
      p_pickup_method: "message_after_order"
    });
    expect(error).toBeNull();
    expect(data?.[0]?.store_id).toBeTruthy();

    const { data: sellers } = await service
      .from("sellers")
      .select("id")
      .eq("user_id", userId);
    expect(sellers).toHaveLength(1);
    const sellerId = sellers?.[0]?.id;
    expect(sellerId).toBeTruthy();

    const { data: stores } = await service
      .from("stores")
      .select("id, slug, visibility, accept_pay_at_pickup, logo_url, category")
      .eq("seller_id", sellerId!);
    expect(stores).toHaveLength(1);
    const store = stores?.[0];
    expect(store?.visibility).toBe("qr_only");
    expect(store?.accept_pay_at_pickup).toBe(true);
    expect(store?.logo_url).toBeNull();
    expect(store?.category).toBeNull();

    const { data: products } = await service
      .from("products")
      .select("id, price_cents, name")
      .eq("store_id", store!.id);
    expect(products).toHaveLength(1);
    expect(products?.[0]?.price_cents).toBe(1200);

    const { data: memberships } = await service
      .from("building_memberships")
      .select("id")
      .eq("store_id", store!.id);
    expect(memberships).toHaveLength(0);
  });

  it("guards a duplicate tenant — a second call errors and leaves no orphan rows", async () => {
    const { error } = await service.rpc("create_store_quickstart", {
      p_user_id: userId,
      p_display_name: "Priya Again",
      p_contact_email: email,
      p_store_name: "Second Stoop",
      p_slug_base: `second-stoop-${Date.now()}`,
      p_item_name: "Croissants",
      p_price_cents: 500,
      p_pickup_method: "lobby_pickup"
    });
    expect(error).not.toBeNull();

    const { data: sellers } = await service
      .from("sellers")
      .select("id")
      .eq("user_id", userId);
    expect(sellers).toHaveLength(1);

    const sellerId = sellers?.[0]?.id;
    const { data: stores } = await service
      .from("stores")
      .select("id")
      .eq("seller_id", sellerId!);
    expect(stores).toHaveLength(1);
  });

  it("allocates a bounded random suffix when the preferred slug is taken", async () => {
    const { data: sellers } = await service
      .from("sellers")
      .select("id")
      .eq("user_id", userId);
    const sellerId = sellers?.[0]?.id;
    const { data: stores } = await service
      .from("stores")
      .select("slug")
      .eq("seller_id", sellerId!);
    const takenSlug = stores?.[0]?.slug;
    expect(takenSlug).toBeTruthy();

    const tag = `${Date.now()}-${generateToken().slice(0, 6)}`;
    const collidingEmail = `quickstart-collision-${tag}@example.test`;
    const password = `pw-${generateToken()}`;
    const { data: created, error: userError } = await service.auth.admin.createUser({
      email: collidingEmail,
      password,
      email_confirm: true
    });
    expect(userError).toBeNull();
    expect(created.user?.id).toBeTruthy();
    extraUserIds.push(created.user!.id);

    const { data, error } = await service.rpc("create_store_quickstart", {
      p_user_id: created.user!.id,
      p_display_name: "Collision Test",
      p_contact_email: collidingEmail,
      p_store_name: "Collision Test",
      p_slug_base: takenSlug!,
      p_item_name: "Cookies",
      p_price_cents: 900,
      p_pickup_method: "message_after_order"
    });

    expect(error).toBeNull();
    expect(data?.[0]?.slug).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(data?.[0]?.slug).not.toBe(takenSlug);
  });

  it("does not expose tenant creation to authenticated clients", async () => {
    const tag = `${Date.now()}-${generateToken().slice(0, 6)}`;
    const blockedEmail = `quickstart-blocked-${tag}@example.test`;
    const password = `pw-${generateToken()}`;
    const { data: created, error: userError } = await service.auth.admin.createUser({
      email: blockedEmail,
      password,
      email_confirm: true
    });
    expect(userError).toBeNull();
    expect(created.user?.id).toBeTruthy();
    extraUserIds.push(created.user!.id);

    const blockedClient = await authedClient(blockedEmail, password);
    const { error } = await blockedClient.rpc("create_store_quickstart", {
      p_user_id: created.user!.id,
      p_display_name: "Direct Call",
      p_contact_email: blockedEmail,
      p_store_name: "Direct Call",
      p_slug_base: `direct-call-${tag}`,
      p_item_name: "Cookies",
      p_price_cents: 900,
      p_pickup_method: "message_after_order"
    });

    expect(error).not.toBeNull();
  });
});

describe("store deletion cascade", () => {
  it("deletes a store and cascades to its products and order_items", async () => {
    const { data: sellers } = await service
      .from("sellers")
      .select("id")
      .eq("user_id", userId);
    const sellerId = sellers?.[0]?.id;
    const { data: stores } = await service
      .from("stores")
      .select("id")
      .eq("seller_id", sellerId!);
    const storeId = stores?.[0]?.id;
    expect(storeId).toBeTruthy();

    const { data: order } = await service
      .from("orders")
      .insert({
        store_id: storeId!,
        customer_name: "Sam",
        customer_email: "sam@example.test",
        total_cents: 1200,
        payment_mode: "pay_at_pickup",
        payment_status: "pay_at_pickup",
        idempotency_key: `idem-${Date.now()}`,
        request_hash: `hash-${Date.now()}`
      })
      .select("id")
      .single();
    await service.from("order_items").insert({
      order_id: order!.id,
      name_at_purchase: "Cookies",
      quantity: 1,
      price_cents_at_purchase: 1200
    });

    await service.from("stores").delete().eq("id", storeId!);

    const { data: products } = await service
      .from("products")
      .select("id")
      .eq("store_id", storeId!);
    expect(products).toHaveLength(0);

    const { data: items } = await service
      .from("order_items")
      .select("id")
      .eq("order_id", order!.id);
    expect(items).toHaveLength(0);
  });
});
