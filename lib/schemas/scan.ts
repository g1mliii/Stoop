import { z } from "zod";

import { uuid } from "./common";

// Phase 7.4: the public scan beacon's input. `src` is attacker-reachable (anyone can hit
// /api/scan), so it's clamped to a short lowercase slug — charset + length cap, never free text —
// and anything malformed or missing degrades to "direct" rather than rejecting the beacon.

export const SCAN_SRC_FALLBACK = "direct";
// Attribution is a fixed product taxonomy, not user-controlled analytics text. Keeping this set
// bounded guarantees public scan requests cannot create unbounded aggregate-row cardinality.
export const SCAN_SOURCES = [
  "direct",
  "instagram",
  "whatsapp",
  "poster",
  "qr"
] as const;

const srcSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.enum(SCAN_SOURCES)
  )
  .catch(SCAN_SRC_FALLBACK);

export const scanParamsSchema = z.object({
  store: uuid,
  src: srcSchema
});

export type ScanParams = z.infer<typeof scanParamsSchema>;

// The aggregate row — deliberately the entire shape of the table. The integration test asserts
// these are the only columns, i.e. that no PII rides along.
export const scanEventDailyRowSchema = z.object({
  store_id: uuid,
  src: z.string(),
  day: z.string(),
  bucket: z.number().int().min(0).max(15),
  count: z.number().int().nonnegative()
});

export type ScanEventDailyRow = z.infer<typeof scanEventDailyRowSchema>;
