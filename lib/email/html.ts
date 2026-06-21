// Shared HTML escaping for email templates. One copy so the customer- and seller-facing
// templates can't drift to a weaker escaper.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared physical-address footer. One copy so the order- and payment-confirmation templates
 *  can't drift on brand name or styling. */
export function emailFooter(address?: string): { text: string; html: string } {
  const brand = "Stoop";
  const text = address ? `${brand}\n${address}` : brand;
  const html = address
    ? `<p style="color:#7a766c;font-size:12px;margin-top:24px;">${brand}<br/>${escapeHtml(
        address
      )}</p>`
    : `<p style="color:#7a766c;font-size:12px;margin-top:24px;">${brand}</p>`;
  return { text, html };
}
