// Phase 3.3 shell placeholder. The Money screen (4 KPIs + Stripe handoff) lands in Phase 5 —
// Stripe owns charges, payouts, refunds, and 1099-Ks (hard invariant 10).
export default function MoneyPage() {
  return (
    <section className="mx-auto max-w-4xl">
      <h1 className="font-display text-28 text-ink">Money</h1>
      <p className="mt-1 text-15 text-ink-2">
        Connect Stripe to take online payments and see your earnings here.
      </p>
    </section>
  );
}
