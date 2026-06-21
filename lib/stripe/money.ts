import "server-only";

import * as Sentry from "@sentry/nextjs";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/client";
import { createSupabaseSecretClient } from "@/lib/supabase/secret";

// Phase 5.11a: the Money screen's read-only KPIs, pulled live from Stripe for the seller's
// connected account (destination-charge model — the money lives on the connected account, so every
// read passes { stripeAccount }). Each piece is independently guarded: a partial Stripe failure
// degrades that KPI to null (rendered as "—") rather than blanking the screen. Lists auto-paginate
// (a single 100-row page would silently under-count an active seller's totals), bounded by a sane
// safety cap so a runaway account can't loop forever.

export type MoneyKpis = {
  nextPayout: { amountCents: number; arrivalDate: number | null; chargeCount: number | null } | null;
  todayNetCents: number | null;
  last30GrossCents: number | null;
  last30PaidOutCents: number | null;
  bank: { label: string; scheduleSummary: string } | null;
};

export type RecentRefund = {
  orderId: string;
  customerName: string;
  amountCents: number;
  when: string;
};

// Upper bound on records walked per KPI so an unexpectedly huge history can't spin forever. Well
// above any realistic 30-day window for an MVP seller; a breach is logged by the caller's guard.
const MAX_PAGE_WALK = 10_000;

/** Run a KPI fetch, degrading a partial Stripe failure to null (rendered as "—") instead of
 *  blanking the whole screen. The failure is still reported to Sentry so a systematically broken
 *  KPI is distinguishable from genuine "no data". */
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/** Sum a Stripe list resource across all pages (auto-pagination), accumulating with `pick`. */
async function sumList<T>(
  page: Stripe.ApiListPromise<T>,
  pick: (item: T) => number
): Promise<number> {
  let total = 0;
  let walked = 0;
  for await (const item of page) {
    total += pick(item);
    if (++walked >= MAX_PAGE_WALK) break;
  }
  return total;
}

function startOfTodayUnix(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
}

function daysAgoUnix(days: number): number {
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
}

function scheduleSummary(schedule?: Stripe.Account.Settings.Payouts.Schedule): string {
  if (!schedule) return "—";
  switch (schedule.interval) {
    case "daily":
      return "daily payouts";
    case "manual":
      return "manual payouts";
    case "weekly":
      return schedule.weekly_anchor
        ? `weekly payouts, ${schedule.weekly_anchor}s`
        : "weekly payouts";
    case "monthly":
      return "monthly payouts";
    default:
      return `${schedule.interval} payouts`;
  }
}

export async function loadMoneyKpis(stripeAccountId: string): Promise<MoneyKpis> {
  const stripe = getStripe();
  const opts = { stripeAccount: stripeAccountId };

  // The five KPIs are independent Stripe reads; fetch them in parallel so page TTFB is the slowest
  // call, not the sum. Each is still individually guarded by safe().
  const [nextPayout, todayNetCents, last30GrossCents, last30PaidOutCents, bank] = await Promise.all([
    safe<MoneyKpis["nextPayout"]>(async () => {
      const payouts = await stripe.payouts.list({ status: "pending", limit: 100 }, opts);
      if (payouts.data.length === 0) return null;
      const soonest = payouts.data.reduce((a, b) => (a.arrival_date <= b.arrival_date ? a : b));
      const chargeCount = await safe(() =>
        sumList(
          stripe.balanceTransactions.list({ payout: soonest.id, type: "charge", limit: 100 }, opts),
          () => 1
        )
      );
      // The "next payout" is the soonest one; its amount, arrival date, and charge count must all
      // describe that same payout (summing every pending payout's amount would mismatch the date).
      return { amountCents: soonest.amount, arrivalDate: soonest.arrival_date, chargeCount };
    }),

    safe(() =>
      // Net change to the balance today = every balance transaction except payouts (which move
      // already-earned money to the bank, not earnings). Summing `net` captures charges, refunds,
      // disputes, adjustments, and fees correctly; an allowlist of types would silently drop
      // disputes/adjustments and misreport "net".
      sumList(
        stripe.balanceTransactions.list({ created: { gte: startOfTodayUnix() }, limit: 100 }, opts),
        (t) =>
          t.type === "payout" || t.type === "payout_cancel" || t.type === "payout_failure"
            ? 0
            : t.net
      )
    ),

    safe(() =>
      sumList(
        stripe.balanceTransactions.list(
          { created: { gte: daysAgoUnix(30) }, type: "charge", limit: 100 },
          opts
        ),
        (t) => t.amount
      )
    ),

    safe(() =>
      sumList(
        stripe.payouts.list(
          { status: "paid", arrival_date: { gte: daysAgoUnix(30) }, limit: 100 },
          opts
        ),
        (p) => p.amount
      )
    ),

    safe<MoneyKpis["bank"]>(async () => {
      const account = await stripe.accounts.retrieve(stripeAccountId);
      const external = account.external_accounts?.data.find(
        (e): e is Stripe.BankAccount => e.object === "bank_account"
      );
      if (!external) return null;
      const name = external.bank_name ?? "Bank";
      return {
        label: `${name} •••• ${external.last4}`,
        scheduleSummary: scheduleSummary(account.settings?.payouts?.schedule)
      };
    })
  ]);

  return { nextPayout, todayNetCents, last30GrossCents, last30PaidOutCents, bank };
}

/** Last 5 refunds this month for the seller's stores, read-only (the refund action lives in
 *  Orders — Phase 5.8 / 6.4). */
export async function loadRecentRefunds(sellerId: string): Promise<RecentRefund[]> {
  const supabase = createSupabaseSecretClient();
  const { data: stores } = await supabase
    .from("stores")
    .select("id")
    .eq("seller_id", sellerId);
  const storeIds = (stores ?? []).map((s) => s.id);
  if (storeIds.length === 0) return [];

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: refunds } = await supabase
    .from("orders")
    .select("id, customer_name, total_cents, updated_at")
    .in("store_id", storeIds)
    .eq("payment_status", "refunded")
    .gte("updated_at", startOfMonth)
    .order("updated_at", { ascending: false })
    .limit(5);

  return (refunds ?? []).map((r) => ({
    orderId: r.id,
    customerName: r.customer_name,
    amountCents: r.total_cents,
    when: r.updated_at
  }));
}
