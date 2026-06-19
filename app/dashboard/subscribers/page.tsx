import { Users } from "lucide-react";
import Link from "next/link";

import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { EMPTY_STATES } from "@/lib/copy/empty-states";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SubscriberRow = { id: string; email: string; created_at: string };

export default async function SubscribersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let subscribers: SubscriberRow[] = [];
  if (store) {
    // subscribers is a PII table — explicit columns only (hard invariant 6).
    const { data } = await supabase
      .from("subscribers")
      .select("id, email, created_at")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false })
      .limit(100);
    subscribers = data ?? [];
  }

  return (
    <section className="mx-auto max-w-4xl">
      <h1 className="mb-5 font-display text-36 leading-none text-ink">
        Subscribers
      </h1>

      {subscribers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={EMPTY_STATES.subscribers.title}
          body={EMPTY_STATES.subscribers.body}
          action={
            <Button asChild>
              <Link href="/dashboard/qr">Open your QR</Link>
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
          {subscribers.map((subscriber) => (
            <div
              key={subscriber.id}
              className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0"
            >
              <span className="truncate text-14 text-ink">
                {subscriber.email}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
