"use client";

import { AlertCircle, ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Toast } from "@/app/components/ui/toast";
import {
  createDashboardLoginLink,
  startStripeOnboarding
} from "@/lib/actions/stripe-connect";
import { formatMoney } from "@/lib/pricing/currency";
import { formatBps, PLATFORM_FEE_BPS } from "@/lib/pricing/fee";
import { cn } from "@/lib/utils/cn";
import type { MoneyKpis, RecentRefund } from "@/lib/stripe/money";

// Phase 5.11: matches ui_kits/seller/MoneyScreen.jsx. One page — there is no Payments page and no
// Payouts page. The fee percentage is interpolated from the single constant (5.10), never typed.

const FEE = formatBps(PLATFORM_FEE_BPS);
const SHORT_DATE = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short"
});

// All three handoff buttons open the same Stripe-hosted Express dashboard (Stripe owns this UI);
// only their label and emphasis differ.
const HANDOFF_LINKS: { label: string; variant: "primary" | "secondary" | "ghost"; icon?: boolean }[] =
  [
    { label: "Open Stripe Dashboard", variant: "primary", icon: true },
    { label: "Change bank account", variant: "secondary" },
    { label: "View 1099 tax form", variant: "ghost" }
  ];

type MoneyScreenProps = {
  chargesEnabled: boolean;
  kpis: MoneyKpis | null;
  refunds: RecentRefund[];
};

function money(cents: number | null): string {
  return cents === null ? "—" : formatMoney(cents);
}

function shortDate(value: string | number | null): string {
  if (value === null) return "soon";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return SHORT_DATE.format(date);
}

function Kpi({
  label,
  value,
  sub,
  primary
}: {
  label: string;
  value: string;
  sub: string;
  primary?: boolean;
}) {
  return (
    <Card
      className={cn(
        "p-4 sm:p-4",
        primary && "border-verdigris bg-verdigris-3"
      )}
    >
      <div className="ab-eyebrow text-ink-3">{label}</div>
      <div className="mt-1 font-mono text-24 font-bold tabular-nums text-ink">{value}</div>
      <div className="mt-1 font-sans text-12 text-ink-2">{sub}</div>
    </Card>
  );
}

export function MoneyScreen({ chargesEnabled, kpis, refunds }: MoneyScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function goToLink(action: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        window.location.href = result.url;
        return;
      }
      setError(result.error);
    });
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-36 leading-none text-ink">Money</h1>
        <p className="mt-1 font-sans text-13 text-ink-3">
          via Stripe Connect Express · platform fee {FEE}
        </p>
      </header>

      {chargesEnabled ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Next payout"
            primary
            sub={
              kpis?.nextPayout
                ? `arrives ${shortDate(kpis.nextPayout.arrivalDate)}${
                    kpis.nextPayout.chargeCount !== null
                      ? ` · ${kpis.nextPayout.chargeCount} charges`
                      : ""
                  }`
                : "no payout scheduled"
            }
            value={money(kpis?.nextPayout?.amountCents ?? null)}
          />
          <Kpi
            label="Today (net)"
            sub={`after Stoop's ${FEE} fee`}
            value={money(kpis?.todayNetCents ?? null)}
          />
          <Kpi
            label="Last 30 days"
            sub={`paid out: ${money(kpis?.last30PaidOutCents ?? null)}`}
            value={money(kpis?.last30GrossCents ?? null)}
          />
          <Kpi
            label="Bank on file"
            sub={kpis?.bank?.scheduleSummary ?? "—"}
            value={kpis?.bank?.label ?? "—"}
          />
        </div>
      ) : null}

      {error ? (
        <Toast className="w-full justify-center" tone="danger">
          {error}
        </Toast>
      ) : null}

      {chargesEnabled ? (
        <Card>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mulberry font-display text-20 font-bold text-surface">
              S
            </div>
            <div className="flex-1">
              <h2 className="font-display text-20 text-ink">
                Charges, payouts, refunds &amp; tax forms
              </h2>
              <p className="mt-1 max-w-[540px] font-sans text-13 leading-relaxed text-ink-2">
                Lives in your Stripe Express dashboard. Stoop keeps a thin summary here so you can
                check at a glance — for the ledger, payout schedule edits, bank account changes, and
                1099-K forms, open Stripe.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {HANDOFF_LINKS.map((link) => (
                  <Button
                    disabled={pending}
                    key={link.label}
                    onClick={() => goToLink(createDashboardLoginLink)}
                    type="button"
                    variant={link.variant}
                  >
                    {link.label}
                    {link.icon ? (
                      <ExternalLink aria-hidden="true" className="ml-1.5 h-4 w-4 stroke-[1.5]" />
                    ) : null}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-start gap-4">
            <AlertCircle
              aria-hidden="true"
              className="h-6 w-6 shrink-0 stroke-[1.5] text-warning"
            />
            <div className="flex-1">
              <div className="font-sans text-15 font-semibold text-ink">
                One more step — connect your bank.
              </div>
              <p className="mt-1 font-sans text-13 leading-relaxed text-ink-2">
                Until Stripe&apos;s connected, customers can&apos;t pay online. You can still take
                orders for pay-at-pickup.
              </p>
            </div>
            <Button
              disabled={pending}
              onClick={() => goToLink(startStripeOnboarding)}
              size="sm"
              type="button"
              variant="ink"
            >
              Connect Stripe
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-display text-20 text-ink">Refunds this month</h2>
        <p className="mt-1 font-sans text-13 leading-relaxed text-ink-2">
          Refunds are issued from each order&apos;s detail panel — go to Orders, open an order, and
          choose &ldquo;Cancel &amp; refund.&rdquo; Stoop calls Stripe&apos;s refunds API and the
          customer&apos;s confirmation email goes out automatically.
        </p>
        {refunds.length === 0 ? (
          <div className="py-5 font-sans text-14 text-ink-3">No refunds this month.</div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {refunds.map((refund) => (
              <li
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2"
                key={refund.orderId}
              >
                <span className="font-mono text-13 tabular-nums text-ink">
                  #{refund.orderId.replace(/-/g, "").slice(0, 6).toUpperCase()}
                </span>
                <span className="truncate font-sans text-13 text-ink-2">
                  {refund.customerName}
                </span>
                <span className="text-right font-mono text-13 tabular-nums text-ink">
                  −{money(refund.amountCents)}
                  <span className="ml-3 text-ink-3">{shortDate(refund.when)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="font-sans text-12 leading-relaxed text-ink-3">
        Stoop never holds your money. Customers pay directly into your Stripe Express account;
        Stoop&apos;s {FEE} fee is deducted at the point of sale via Stripe&apos;s{" "}
        <span className="font-mono">application_fee_amount</span>. We see balances but never custody
        funds. <strong className="font-semibold">Sales tax is your responsibility — Stoop
        doesn&apos;t run Stripe Tax in v1.</strong>
      </p>
    </section>
  );
}
