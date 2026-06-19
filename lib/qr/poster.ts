import "server-only";

import QRCode from "qrcode";

import { requiredEnv } from "@/lib/env";

// Phase 3.1a: the minimum useful QR. Phase 7.1 hardens this into the full sharing system
// (PNG buffers, channel attribution, branded finder cell). Here we only need an SVG that
// points at the public storefront so a brand-new seller can print a poster in minutes.

/** Public storefront URL for a store slug. No tracking suffix on the printable version. */
export function storefrontUrl(slug: string): string {
  const base = requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
  return `${base}/s/${slug}`;
}

// The QR library needs concrete color literals (it's image data, not a styleable surface).
// `dark` is the --ab-ink token value; `light` is transparent so the poster card shows through.
const QR_INK = "#1C1A16";
const QR_TRANSPARENT = "#00000000";

/** Returns an inline SVG QR string for the store's public storefront. */
export async function storefrontQrSvg(slug: string): Promise<string> {
  return QRCode.toString(storefrontUrl(slug), {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: QR_INK, light: QR_TRANSPARENT }
  });
}
