import { getSeller } from "@/lib/auth/session";
import { getConnectedAccount } from "@/lib/stripe/connected-account";
import { loadMoneyKpis, loadRecentRefunds, type MoneyKpis } from "@/lib/stripe/money";

import { MoneyScreen } from "./money-screen";

// Phase 5.11: the Money screen. A thin overview that delegates the real money UI (charges,
// payouts, refund history, bank changes, 1099-Ks) to Stripe's Express Dashboard (hard invariant
// 10). KPIs are read live from Stripe; the refunds list is read-only from our own DB.
export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const seller = await getSeller();
  if (!seller) {
    return (
      <section className="mx-auto max-w-4xl">
        <h1 className="font-display text-28 text-ink">Money</h1>
        <p className="mt-1 text-15 text-ink-2">Your stoop is still being set up.</p>
      </section>
    );
  }

  const connected = await getConnectedAccount(seller.id);
  const chargesEnabled = connected?.charges_enabled ?? false;

  const [kpis, refunds] = await Promise.all([
    chargesEnabled && connected
      ? loadMoneyKpis(connected.stripe_account_id)
      : Promise.resolve<MoneyKpis | null>(null),
    loadRecentRefunds(seller.id)
  ]);

  return <MoneyScreen chargesEnabled={chargesEnabled} kpis={kpis} refunds={refunds} />;
}
