// Phase 5.10: single source of truth for the platform fee. Every fee figure — the Stripe
// Checkout application_fee_amount, the Money screen copy, the legal note — derives from this
// constant. Never hard-code "3%" anywhere; interpolate formatBps(PLATFORM_FEE_BPS) instead.

/** Platform fee in basis points. 300 bps = 3%. */
export const PLATFORM_FEE_BPS = 300;

/**
 * The platform fee, in integer cents, taken via Stripe's `application_fee_amount`.
 * Always an integer in `[0, total_cents]` for any non-negative input.
 */
export function computePlatformFee(totalCents: number): number {
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return 0;
  }
  return Math.round((totalCents * PLATFORM_FEE_BPS) / 10_000);
}

/** Render a basis-point value as a human percentage: 300 → "3%", 250 → "2.5%". */
export function formatBps(bps: number): string {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toString()}%`;
}
