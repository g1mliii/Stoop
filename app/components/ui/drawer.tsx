"use client";

import { ArrowLeft } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type DrawerProps = {
  children: ReactNode;
  className?: string;
  onBack?: () => void;
  open: boolean;
  side?: "right" | "bottom";
  title: string;
};

export function Drawer({
  children,
  className,
  onBack,
  open,
  side = "right",
  title
}: DrawerProps) {
  const titleId = useId();

  if (!open) {
    return null;
  }

  return (
    <aside
      aria-labelledby={titleId}
      aria-modal="true"
      className={cn(
        "fixed z-40 overflow-y-auto overscroll-contain border-line bg-surface p-6 shadow-lg",
        side === "right" && "inset-y-0 right-0 w-full max-w-md border-l rounded-l-lg",
        side === "bottom" && "inset-x-0 bottom-0 max-h-[80vh] rounded-t-lg border-t",
        className
      )}
      role="dialog"
    >
      <div className="mb-4 flex items-center gap-2">
        {onBack ? (
          <button
            aria-label="Back"
            className="-ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-paper-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdigris"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5 stroke-[1.5]" />
          </button>
        ) : null}
        <h2 className="ab-h2" id={titleId}>
          {title}
        </h2>
      </div>
      {children}
    </aside>
  );
}
