import { Printer } from "lucide-react";
import Link from "next/link";

import { Button } from "@/app/components/ui/button";
import { dismissNudge } from "@/lib/actions/nudge";

// Phase 3.7. Sits atop Orders until the seller dismisses it (or Phase 7 records a first scan).
export function OnboardingNudge() {
  return (
    <div className="mb-4 flex items-start gap-3.5 rounded-lg border border-dashed border-line bg-paper-2 px-4 py-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-verdigris text-surface shadow-sm">
        <Printer className="h-5 w-5 stroke-[1.5]" />
      </span>
      <div className="flex-1">
        <p className="text-14 font-semibold text-ink">
          Print your QR &amp; share it.
        </p>
        <p className="mt-0.5 text-12 text-ink-2">
          Your stoop&apos;s ready. Stick a QR poster on a hallway wall, post it
          to your Instagram bio, or hand out flyers — that&apos;s how orders
          start.
        </p>
        <div className="mt-2.5 flex gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/qr">Download QR poster</Link>
          </Button>
          <form action={dismissNudge}>
            <Button type="submit" variant="ghost" size="sm">
              Dismiss
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
