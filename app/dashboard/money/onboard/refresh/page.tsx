import type { Route } from "next";
import { redirect } from "next/navigation";

import { startStripeOnboarding } from "@/lib/actions/stripe-connect";

// Phase 5.2: Stripe redirects here when an onboarding link expires before the seller finishes.
// Mint a fresh link and send them back into Stripe-hosted onboarding.
export const dynamic = "force-dynamic";

export default async function OnboardRefreshPage() {
  const result = await startStripeOnboarding();
  if (result.ok) {
    redirect(result.url as Route);
  }
  redirect("/dashboard/money");
}
