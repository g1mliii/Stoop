import { redirect } from "next/navigation";

import { refreshConnectedAccount } from "@/lib/actions/stripe-connect";
import { getSeller } from "@/lib/auth/session";

// Phase 5.2: Stripe sends the seller here after onboarding. Sync the live account flags into
// connected_accounts (the webhook also does this, but syncing on return makes the Money screen
// reflect "ready" immediately) and bounce to the Money screen.
export const dynamic = "force-dynamic";

export default async function OnboardReturnPage() {
  const seller = await getSeller();
  if (!seller) {
    redirect("/login");
  }
  try {
    await refreshConnectedAccount();
  } catch {
    // The webhook is the durable source of truth; a transient retrieve failure here is fine.
  }
  redirect("/dashboard/money");
}
