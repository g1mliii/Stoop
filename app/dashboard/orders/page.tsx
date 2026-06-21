import { Package } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { OnboardingNudge } from "@/app/components/onboarding/onboarding-nudge";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Stamp, type StampStatus } from "@/app/components/ui/stamp";
import { NUDGE_DISMISSED_COOKIE } from "@/lib/cookie-names";
import { EMPTY_STATES } from "@/lib/copy/empty-states";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/pricing/currency";

type OrderRow = {
  id: string;
  customer_name: string;
  total_cents: number;
  order_status: StampStatus;
  created_at: string;
};

export default async function OrdersPage() {
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  const nudgeDismissed =
    cookieStore.get(NUDGE_DISMISSED_COOKIE)?.value === "1";

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let orders: OrderRow[] = [];
  if (store) {
    const { data } = await supabase
      .from("orders")
      .select("id, customer_name, total_cents, order_status, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(50);
    orders = data ?? [];
  }

  return (
    <section className="mx-auto max-w-4xl">
      <h1 className="mb-5 font-display text-36 leading-none text-ink">Orders</h1>

      {!nudgeDismissed ? <OnboardingNudge /> : null}

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={EMPTY_STATES.orders.title}
          body={EMPTY_STATES.orders.body}
          action={
            <Button asChild>
              <Link href="/dashboard/qr">Open your QR</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          {orders.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line px-4 py-3 last:border-b-0"
            >
              <span className="truncate text-14 font-semibold text-ink">
                {order.customer_name}
              </span>
              <Stamp status={order.order_status}>{order.order_status}</Stamp>
              <span className="text-right font-mono text-14 font-medium text-ink">
                {formatMoney(order.total_cents)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
