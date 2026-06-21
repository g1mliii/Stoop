import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { sellerRowSchema, type Seller } from "@/lib/schemas/seller";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Phase 2.7: session helpers for protected seller routes. getUser() (not getSession(), not the
// local-only getClaims()) round-trips to Supabase to validate the JWT and honor revocation, so
// this is safe to gate authorization on.
//
// Wrapped in React cache() so the auth round-trip + sellers query run once per request even
// though the dashboard layout and the page both call it. cache() is request-scoped only — it
// never carries a session across requests, so there's no staleness/security risk.

export const getSeller = cache(async (): Promise<Seller | null> => {
  const supabase = await createSupabaseServerClient();

  // getUser() round-trips to the auth server, which both validates the JWT and honors server-side
  // session revocation (sign-out elsewhere, admin ban). Local-only claim verification (getClaims)
  // would accept a validly-signed but revoked token until its natural expiry — not safe to gate a
  // seller dashboard on. The round-trip is request-scoped via cache(), so it runs once per request.
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("sellers")
    // Explicit columns, never `select *` against a PII table (hard invariant 6).
    .select(
      "id, user_id, display_name, contact_email, contact_phone_e164, contact_address, created_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return sellerRowSchema.parse(data);
});

/** Redirects to /login when the visitor isn't a signed-in seller. */
export async function requireSeller(): Promise<Seller> {
  const seller = await getSeller();
  if (!seller) {
    redirect("/login");
  }
  return seller;
}
