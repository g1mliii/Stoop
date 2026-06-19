import { QrCode } from "lucide-react";

import { EmptyState } from "@/app/components/ui/empty-state";
import { Seal } from "@/app/components/ui/seal";
import { requireSeller } from "@/lib/auth/session";
import { EMPTY_STATES } from "@/lib/copy/empty-states";
import { storefrontQrSvg, storefrontUrl } from "@/lib/qr/poster";
import type { PickupMethod } from "@/lib/schemas/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { QrPosterActions } from "./qr-poster-actions";

function pickupLabel(
  method: PickupMethod,
  windowLabel: string | null
): string {
  switch (method) {
    case "lobby_pickup":
      return "Lobby / front desk pickup";
    case "scheduled_window":
      return windowLabel ?? "Pickup at a set window";
    case "message_after_order":
    default:
      return "We'll message you after your order";
  }
}

export default async function QrPage({
  searchParams
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const seller = await requireSeller();
  const { first } = await searchParams;
  const isFirstLoad = first === "1";

  const supabase = await createSupabaseServerClient();
  const { data: store } = await supabase
    .from("stores")
    .select("slug, name, pickup_method, pickup_window_label")
    .eq("seller_id", seller.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!store) {
    return (
      <section className="mx-auto max-w-2xl">
        <h1 className="font-display text-28 text-ink">QR &amp; sharing</h1>
        <p className="mt-2 text-15 text-ink-2">
          Your stoop is still being set up. Add a store to generate a QR.
        </p>
      </section>
    );
  }

  const url = storefrontUrl(store.slug);
  const svgMarkup = await storefrontQrSvg(store.slug);

  return (
    <section className="mx-auto max-w-3xl">
      {isFirstLoad ? (
        <div className="mb-6 flex items-center gap-4 rounded-md border border-line bg-surface px-5 py-4 shadow-sm print:hidden">
          <Seal status="paid">Open</Seal>
          <div>
            <p className="font-display text-20 text-ink">Your stoop is open</p>
            <p className="text-14 text-ink-2">
              Print this QR, stick it somewhere people walk past, and you&apos;re
              taking orders.
            </p>
          </div>
        </div>
      ) : (
        <header className="mb-6 print:hidden">
          <h1 className="font-display text-28 text-ink">QR &amp; sharing</h1>
          <p className="mt-1 text-15 text-ink-2">
            Print your QR poster or share your storefront link.
          </p>
        </header>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <article className="mx-auto w-full max-w-sm rounded-xl border border-line bg-surface p-8 text-center shadow-sm">
          <p className="font-display text-28 text-ink">{store.name}</p>
          <p className="mt-1 text-14 text-ink-3">
            {pickupLabel(store.pickup_method, store.pickup_window_label)}
          </p>
          <div
            className="mx-auto mt-6 h-56 w-56 [&_svg]:h-full [&_svg]:w-full"
            // QR is server-rendered SVG from our own poster utility (no user HTML).
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
          <p className="mt-6 text-16 font-semibold text-ink">Scan to order</p>
          <p className="mt-1 font-mono text-13 text-ink-3 break-all">{url}</p>
        </article>

        <div className="lg:pt-2">
          <QrPosterActions
            storefrontUrl={url}
            svgMarkup={svgMarkup}
            slug={store.slug}
          />
        </div>
      </div>

      <div className="mt-8 print:hidden">
        <h2 className="mb-3 text-16 font-semibold text-ink">Scans</h2>
        <EmptyState
          icon={QrCode}
          title={EMPTY_STATES.scans.title}
          body={EMPTY_STATES.scans.body}
        />
      </div>
    </section>
  );
}
