"use server";

import { appBaseUrl } from "@/lib/env";
import { getSeller } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe/client";
import {
  getConnectedAccount,
  insertConnectedAccount,
  syncFromStripe
} from "@/lib/stripe/connected-account";

// Phase 5.1/5.2: Stripe Connect Express onboarding. Each seller gets their own connected account
// (we never custody funds). Onboarding and the Express Dashboard are reached through Stripe-hosted
// links — Stoop never rebuilds that UI (hard invariant 10).

export type LinkResult = { ok: true; url: string } | { ok: false; error: string };

async function ensureStripeAccountId(): Promise<
  { ok: true; accountId: string } | { ok: false; error: string }
> {
  const seller = await getSeller();
  if (!seller) {
    return { ok: false, error: "Please sign in." };
  }

  const existing = await getConnectedAccount(seller.id);
  if (existing) {
    return { ok: true, accountId: existing.stripe_account_id };
  }

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country: "CA",
    email: seller.contact_email ?? undefined,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    }
  });
  await insertConnectedAccount(seller.id, account.id);
  return { ok: true, accountId: account.id };
}

/** Start (or resume) Connect onboarding. Returns a Stripe-hosted URL the client redirects to. */
export async function startStripeOnboarding(): Promise<LinkResult> {
  try {
    const ensured = await ensureStripeAccountId();
    if (!ensured.ok) {
      return ensured;
    }

    const base = appBaseUrl();
    const link = await getStripe().accountLinks.create({
      account: ensured.accountId,
      type: "account_onboarding",
      refresh_url: `${base}/dashboard/money/onboard/refresh`,
      return_url: `${base}/dashboard/money/onboard/return`
    });
    return { ok: true, url: link.url };
  } catch {
    return { ok: false, error: "Couldn't reach Stripe — try again in a moment." };
  }
}

/**
 * A Stripe-hosted Express Dashboard login link for the Money screen handoff buttons (open
 * dashboard, change bank account, view 1099). Stripe owns all of that UI.
 */
export async function createDashboardLoginLink(): Promise<LinkResult> {
  try {
    const seller = await getSeller();
    if (!seller) {
      return { ok: false, error: "Please sign in." };
    }
    const connected = await getConnectedAccount(seller.id);
    if (!connected) {
      return { ok: false, error: "Connect Stripe first." };
    }
    const link = await getStripe().accounts.createLoginLink(
      connected.stripe_account_id
    );
    return { ok: true, url: link.url };
  } catch {
    return { ok: false, error: "Couldn't reach Stripe — try again in a moment." };
  }
}

/**
 * Retrieve the live account from Stripe and mirror its flags into connected_accounts.
 * This is a `"use server"` action, so it's a network-reachable endpoint — it must authenticate
 * the caller and derive the seller from the session, never accept a seller id as an argument
 * (which would let anyone trigger a sync for an arbitrary tenant).
 */
export async function refreshConnectedAccount(): Promise<void> {
  const seller = await getSeller();
  if (!seller) {
    return;
  }
  const connected = await getConnectedAccount(seller.id);
  if (!connected) {
    return;
  }
  await syncFromStripe(connected.stripe_account_id);
}
