"use client";

import {
  Building2,
  ChevronDown,
  ExternalLink,
  Menu,
  Package,
  QrCode,
  ShoppingBag,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
  type LucideIcon
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Logo } from "@/app/components/brand/logo";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils/cn";

type NavItem = {
  key: string;
  label: string;
  href: Route;
  icon: LucideIcon;
};

type NavGroup = { section: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    section: "Shop",
    items: [
      { key: "orders", label: "Orders", href: "/dashboard/orders", icon: Package },
      { key: "products", label: "Products", href: "/dashboard/products", icon: ShoppingBag },
      { key: "subscribers", label: "Subscribers", href: "/dashboard/subscribers", icon: Users }
    ]
  },
  {
    section: "Share",
    items: [
      { key: "qr", label: "QR & sharing", href: "/dashboard/qr", icon: QrCode },
      { key: "bazaar", label: "Building bazaar", href: "/dashboard/bazaar", icon: Building2 }
    ]
  },
  {
    section: "Money",
    items: [{ key: "money", label: "Money", href: "/dashboard/money", icon: Wallet }]
  },
  {
    section: "Account",
    items: [
      { key: "settings", label: "Settings", href: "/dashboard/settings", icon: SlidersHorizontal }
    ]
  }
];

// Bottom action bar on mobile surfaces the primary sections as quick tabs.
const ALL_ITEMS = NAV.flatMap((group) => group.items);
const MOBILE_TABS: NavItem[] = ["orders", "products", "qr", "money", "settings"]
  .map((key) => ALL_ITEMS.find((item) => item.key === key))
  .filter((item): item is NavItem => Boolean(item));

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardChrome({
  children,
  initials,
  publicUrl,
  storeName
}: {
  children: ReactNode;
  initials: string;
  publicUrl: string;
  storeName: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-verdigris-2 bg-verdigris px-3 text-surface sm:px-5">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-verdigris-2 md:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <span className="flex items-center rounded-md bg-surface px-2 py-1 shadow-sm">
          <Logo size={22} />
        </span>

        <span className="hidden items-center border-l border-surface/25 pl-4 font-mono text-12 uppercase tracking-[0.06em] text-surface/70 sm:inline-flex">
          Shop
          <b className="ml-2 font-sans text-13 font-semibold normal-case tracking-normal text-surface">
            {storeName}
          </b>
        </span>

        <div className="flex-1" />

        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-2 rounded-md px-3 py-1.5 text-13 font-medium text-surface/85 hover:bg-verdigris-2 hover:text-surface sm:inline-flex"
        >
          <ExternalLink className="h-4 w-4" />
          View public stoop
        </a>

        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-pill"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((v) => !v)}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-pill bg-marigold font-sans text-12 font-bold text-ink shadow-sm">
              {initials}
            </span>
            <ChevronDown className="h-4 w-4 text-surface/80" />
          </button>
          {accountOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-10 w-48 rounded-md border border-line bg-surface p-1 text-ink shadow-md"
            >
              <Link
                role="menuitem"
                href="/dashboard/settings"
                className="block rounded-sm px-3 py-2 text-14 hover:bg-paper-2"
                onClick={() => setAccountOpen(false)}
              >
                Settings
              </Link>
              <a
                role="menuitem"
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-sm px-3 py-2 text-14 hover:bg-paper-2 sm:hidden"
                onClick={() => setAccountOpen(false)}
              >
                View public stoop
              </a>
              <form action={signOut}>
                <button
                  type="submit"
                  role="menuitem"
                  className="block w-full rounded-sm px-3 py-2 text-left text-14 text-danger hover:bg-danger-3"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 md:grid md:grid-cols-[240px_1fr]">
        <aside className="hidden flex-col gap-0.5 border-r border-line bg-paper px-3 py-4 md:flex">
          {NAV.map((group) => (
            <div key={group.section}>
              <p className="px-3 pb-1.5 pt-3 font-mono text-12 uppercase tracking-[0.08em] text-ink-3">
                {group.section}
              </p>
              {group.items.map((item) => (
                <NavLink key={item.key} item={item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          ))}
        </aside>

        {menuOpen ? (
          <nav className="border-b border-line bg-paper px-3 py-3 md:hidden">
            {NAV.map((group) => (
              <div key={group.section}>
                <p className="px-3 pb-1.5 pt-3 font-mono text-12 uppercase tracking-[0.08em] text-ink-3">
                  {group.section}
                </p>
                {group.items.map((item) => (
                  <NavLink
                    key={item.key}
                    item={item}
                    active={isActive(pathname, item.href)}
                    onNavigate={() => setMenuOpen(false)}
                  />
                ))}
              </div>
            ))}
          </nav>
        ) : null}

        <main className="min-w-0 flex-1 px-3 pb-24 pt-5 sm:px-6 md:pb-12 md:pt-6">
          {children}
        </main>
      </div>

      <nav className="sticky bottom-0 z-20 flex h-16 items-stretch border-t border-line bg-surface md:hidden">
        {MOBILE_TABS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-12",
                active ? "text-verdigris-2" : "text-ink-3"
              )}
            >
              <Icon className="h-5 w-5 stroke-[1.5]" />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavLink({
  active,
  item,
  onNavigate
}: {
  active: boolean;
  item: NavItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-14 font-medium transition-colors duration-fast ease-stoop",
        active
          ? "bg-verdigris-3 text-verdigris-2 shadow-[inset_3px_0_0_var(--ab-verdigris)]"
          : "text-ink-2 hover:bg-paper-2 hover:text-ink"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-5 w-5 stroke-[1.5]" />
      {item.label}
    </Link>
  );
}
