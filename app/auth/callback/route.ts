import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import { screenStoreName } from "@/lib/security/store-name";
import { generateUniqueSlug } from "@/lib/utils/slug";
import {
  SIGNUP_COOKIE_NAME,
  verifyPendingSignup
} from "@/lib/utils/quickstart-cookie";
import { createSupabaseSecretClient } from "@/lib/supabase/secret";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Phase 2.7 + 3.2: magic-link landing. Supabase redirects here with a PKCE `code`; we exchange
// it for a session, then branch:
//   - returning seller (a sellers row already exists) → normal login redirect.
//   - brand-new user carrying a valid quick-start cookie → atomically create their tenant via
//     create_store_quickstart and land them on the first-QR poster.

const FIRST_QR_DESTINATION = "/dashboard/qr?first=1";

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/dashboard";
  // Only allow same-site relative paths; reject protocol-relative ("//evil") and
  // backslash ("/\evil") bypasses so `next` can't redirect off-site.
  const safeNext =
    requestedNext.startsWith("/") &&
    !requestedNext.startsWith("//") &&
    !requestedNext.startsWith("/\\")
      ? requestedNext
      : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link-expired`);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=link-expired`);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=link-expired`);
  }

  const { data: existingSeller } = await supabase
    .from("sellers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSeller) {
    return NextResponse.redirect(new URL(safeNext, origin));
  }

  // No seller yet — this is a fresh signup if a valid quick-start cookie rode along.
  const cookieStore = await cookies();
  const pending = await verifyPendingSignup(
    cookieStore.get(SIGNUP_COOKIE_NAME)?.value
  );

  if (pending) {
    // Reserved-word-safe base; the RPC makes the final uniqueness check atomic with the insert.
    const slugBase = await generateUniqueSlug(pending.storeName, () => false);
    const { data: created, error: rpcError } = await createSupabaseSecretClient().rpc(
      "create_store_quickstart",
      {
        p_user_id: user.id,
        p_display_name: pending.storeName,
        p_contact_email: user.email ?? "",
        p_store_name: pending.storeName,
        p_slug_base: slugBase,
        p_item_name: pending.itemName,
        p_price_cents: pending.priceCents,
        p_pickup_method: pending.pickupMethod
      }
    );
    if (!rpcError) {
      // Success: clear the cookie so a replay can't try to create a second tenant.
      cookieStore.delete(SIGNUP_COOKIE_NAME);

      // Borderline names (impersonation, regulated categories) passed the signup block but are
      // worth a human look. Drop a review row into the durable audit trail with the real
      // store_id so moderation can take it down if needed. Best-effort: never fail signup over it.
      const screen = screenStoreName(pending.storeName);
      if (screen.action !== "allow") {
        const newStoreId = created?.[0]?.store_id ?? null;
        try {
          await writeAuditLog({
            actorType: "system",
            action: "store_name_flagged",
            targetTable: "stores",
            targetId: newStoreId,
            payload: {
              storeName: pending.storeName,
              tier: screen.action,
              terms: screen.terms
            }
          });
        } catch {
          // Audit is observability, not a signup gate — swallow so the seller still lands.
        }
      }

      return NextResponse.redirect(new URL(FIRST_QR_DESTINATION, origin));
    }
    // Creation failed (a double-clicked link raced another callback, or a transient error). Keep
    // the cookie so a fresh magic link within its TTL can finish setup — the RPC's own duplicate
    // guard makes re-running it safe. Fall through to a normal redirect.
  }

  return NextResponse.redirect(new URL(safeNext, origin));
}
