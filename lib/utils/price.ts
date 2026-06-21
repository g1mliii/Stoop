// Phase 3.4: money is always integer cents internally. This is the only place loose price input
// is parsed to cents for product pricing. Display formatting lives in lib/pricing/currency.ts
// (the single currency source of truth) — import formatMoney from there.

/** Parse loose price input ("$12", "12.5", "12.50") to integer cents. Invalid → 0. */
export function parsePriceToCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dollars = Number.parseFloat(cleaned);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
}
