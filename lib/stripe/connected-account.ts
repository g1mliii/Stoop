import "server-only";

import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/client";
import { createSupabaseSecretClient } from "@/lib/supabase/secret";

// Phase 5: connected_accounts is service-role only (RLS denies anon + authenticated, migration
// 0005/0010). So every read/write of a seller's Stripe Connect state goes through the secret
// client here — never a user-scoped client (which silently returns null under RLS). Callers
// authenticate the seller first, then pass the trusted seller_id.

export type ConnectedAccount = {
  seller_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled: boolean;
  last_synced_at: string | null;
};

const COLUMNS =
  "seller_id, stripe_account_id, charges_enabled, details_submitted, payouts_enabled, last_synced_at";

async function getConnectedAccountBy(
  column: "seller_id" | "stripe_account_id",
  value: string
): Promise<ConnectedAccount | null> {
  const supabase = createSupabaseSecretClient();
  const { data } = await supabase
    .from("connected_accounts")
    .select(COLUMNS)
    .eq(column, value)
    .maybeSingle();
  return data ?? null;
}

export function getConnectedAccount(sellerId: string): Promise<ConnectedAccount | null> {
  return getConnectedAccountBy("seller_id", sellerId);
}

export function getConnectedAccountByStripeId(
  stripeAccountId: string
): Promise<ConnectedAccount | null> {
  return getConnectedAccountBy("stripe_account_id", stripeAccountId);
}

/** Create the connected_accounts row the first time a seller starts onboarding. */
export async function insertConnectedAccount(
  sellerId: string,
  stripeAccountId: string
): Promise<void> {
  const supabase = createSupabaseSecretClient();
  const { error } = await supabase
    .from("connected_accounts")
    .insert({ seller_id: sellerId, stripe_account_id: stripeAccountId });
  if (error) {
    throw new Error(`connected_accounts insert failed: ${error.message}`);
  }
}

/** Mirror the live Stripe account flags into our row. Used by onboarding return + webhooks. */
export async function syncConnectedAccountFlags(
  stripeAccountId: string,
  flags: Pick<
    ConnectedAccount,
    "charges_enabled" | "details_submitted" | "payouts_enabled"
  >
): Promise<void> {
  const supabase = createSupabaseSecretClient();
  const { error } = await supabase
    .from("connected_accounts")
    .update({
      charges_enabled: flags.charges_enabled,
      details_submitted: flags.details_submitted,
      payouts_enabled: flags.payouts_enabled,
      last_synced_at: new Date().toISOString()
    })
    .eq("stripe_account_id", stripeAccountId);
  if (error) {
    throw new Error(`connected_accounts sync failed: ${error.message}`);
  }
}

/**
 * Whether a store can take online payments — i.e. its seller's connected account has
 * charges_enabled. Used to decide whether the storefront offers the "Pay online" path. Reads via
 * the secret client because connected_accounts is service-role only.
 */
export async function storeChargesEnabled(storeId: string): Promise<boolean> {
  const supabase = createSupabaseSecretClient();
  const { data: store } = await supabase
    .from("stores")
    .select("seller_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) return false;
  const { data } = await supabase
    .from("connected_accounts")
    .select("charges_enabled")
    .eq("seller_id", store.seller_id)
    .maybeSingle();
  return data?.charges_enabled ?? false;
}

/** Pull the three boolean flags off a retrieved Stripe account object. */
export function accountFlags(
  account: Stripe.Account
): Pick<
  ConnectedAccount,
  "charges_enabled" | "details_submitted" | "payouts_enabled"
> {
  return {
    charges_enabled: account.charges_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    payouts_enabled: account.payouts_enabled ?? false
  };
}

/** Persist a retrieved Stripe account's flags into our row. */
export async function persistAccountFlags(account: Stripe.Account): Promise<void> {
  await syncConnectedAccountFlags(account.id, accountFlags(account));
}

/** Retrieve the live Stripe account and mirror its flags into our row — the one authority for
 *  the retrieve + sync pair (used by onboarding return + the manual refresh action). */
export async function syncFromStripe(stripeAccountId: string): Promise<void> {
  const account = await getStripe().accounts.retrieve(stripeAccountId);
  await persistAccountFlags(account);
}
