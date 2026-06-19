import { getSeller } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SettingsScreen } from "./settings-screen";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const seller = await getSeller();

  const { data: store } = await supabase
    .from("stores")
    .select(
      "id, slug, name, category, description, logo_url, visibility, pickup_method, pickup_window_label, pickup_public_note, accept_pay_at_pickup, is_active"
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let stripeReady = false;
  if (seller) {
    const { data: connected } = await supabase
      .from("connected_accounts")
      .select("charges_enabled")
      .eq("seller_id", seller.id)
      .maybeSingle();
    stripeReady = connected?.charges_enabled ?? false;
  }

  if (!store || !seller) {
    return (
      <section className="mx-auto max-w-2xl">
        <h1 className="font-display text-36 leading-none text-ink">Settings</h1>
        <p className="mt-2 text-15 text-ink-2">
          Your stoop is still being set up.
        </p>
      </section>
    );
  }

  return (
    <SettingsScreen
      store={store}
      contact={{
        display_name: seller.display_name,
        contact_email: seller.contact_email,
        contact_phone_e164: seller.contact_phone_e164,
        contact_address: seller.contact_address
      }}
      stripeReady={stripeReady}
    />
  );
}
