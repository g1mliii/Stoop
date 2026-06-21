"use server";

import { z } from "zod";

import { getSeller } from "@/lib/auth/session";
import { createSupabaseSecretClient } from "@/lib/supabase/secret";

// Lightweight ownership check for the storefront's seller-preview bar. The public storefront is
// anon + edge-cached, so we never bake seller chrome into the page; instead the bar asks this at
// runtime and renders only for the signed-in owner. Returns false for anonymous customers.
export async function isStoreOwner(storeId: string): Promise<boolean> {
  const parsed = z.string().uuid().safeParse(storeId);
  if (!parsed.success) {
    return false;
  }
  const seller = await getSeller();
  if (!seller) {
    return false;
  }
  const supabase = createSupabaseSecretClient();
  const { data } = await supabase
    .from("stores")
    .select("seller_id")
    .eq("id", parsed.data)
    .maybeSingle();
  return data?.seller_id === seller.id;
}
