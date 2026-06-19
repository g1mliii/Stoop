"use client";

import { Check, Copy, Download, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/app/components/ui/button";

export function QrPosterActions({
  storefrontUrl,
  svgMarkup,
  slug
}: {
  storefrontUrl: string;
  svgMarkup: string;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  function handleDownload() {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stoop-qr-${slug}.svg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(storefrontUrl);
      setCopied(true);
      if (copiedTimeoutRef.current !== null) {
        window.clearTimeout(copiedTimeoutRef.current);
      }
      copiedTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copiedTimeoutRef.current = null;
      }, 2000);
    } catch {
      // Clipboard blocked (insecure context / denied) — the URL is visible on the poster.
    }
  }

  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <Button onClick={() => window.print()}>
        <Printer aria-hidden="true" />
        Print poster
      </Button>
      <Button variant="secondary" onClick={handleDownload}>
        <Download aria-hidden="true" />
        Download QR poster
      </Button>
      <Button variant="secondary" onClick={handleCopy}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Link copied" : "Copy storefront link"}
      </Button>
    </div>
  );
}
