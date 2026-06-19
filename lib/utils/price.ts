// Phase 3.4: money is always integer cents internally. These format/parse helpers are the only
// place dollars↔cents conversion happens for product pricing. Display uses mono + tabular nums.

/** Format cents as `$12` (whole dollars) or `$12.50`. No trailing zero cents on whole dollars. */
export function formatPriceCents(cents: number): string {
  const dollars = cents / 100;
  return cents % 100 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

/** Parse loose price input ("$12", "12.5", "12.50") to integer cents. Invalid → 0. */
export function parsePriceToCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const dollars = Number.parseFloat(cleaned);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
}
