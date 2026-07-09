import { notFound } from "next/navigation";

// Keep the legacy public URL non-enumerable after moving the diagnostic behind founder access.
export default function LegacySentryTestPage() {
  notFound();
}
