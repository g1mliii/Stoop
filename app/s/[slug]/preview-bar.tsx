"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { isStoreOwner } from "@/lib/actions/store-ownership";

// Seller-only preview bar. Renders nothing for anonymous customers (the common case) — it asks the
// server at runtime whether the viewer owns this store, so it can sit on the cached public page
// without leaking seller chrome to customers.
export function SellerPreviewBar({ storeId }: { storeId: string }) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let active = true;
    isStoreOwner(storeId)
      .then((owner) => {
        if (active) setIsOwner(owner);
      })
      .catch(() => {
        // Not signed in / transient — just don't show the bar.
      });
    return () => {
      active = false;
    };
  }, [storeId]);

  if (!isOwner) {
    return null;
  }

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-ink px-4 py-2 text-surface">
      <span className="font-sans text-13">You&apos;re previewing your stoop.</span>
      <Link
        className="inline-flex items-center gap-1.5 rounded-md bg-surface/15 px-3 py-1 font-sans text-13 font-medium hover:bg-surface/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface"
        href="/dashboard"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4 stroke-[1.5]" />
        Back to dashboard
      </Link>
    </div>
  );
}
