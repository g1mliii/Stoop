import { z } from "zod";

import { timestamptz, uuid } from "./common";

// Phase 3.5. The allowlist + size cap are cheap edge checks; deep verification (MIME sniff,
// reject animated/svg/polyglot, dimension clamp) happens in the container worker.
export const ALLOWED_UPLOAD_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp"
] as const;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_IMAGE_EDGE_PX = 2048;

export const imageUploadStatusSchema = z.enum(["pending", "ready", "rejected"]);
export type ImageUploadStatus = z.infer<typeof imageUploadStatusSchema>;

export const imageUploadRowSchema = z.object({
  id: uuid,
  store_id: uuid,
  status: imageUploadStatusSchema,
  key_pending: z.string().nullable(),
  key_final: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  reason: z.string().nullable(),
  requested_by: uuid,
  created_at: timestamptz,
  updated_at: timestamptz
});

export type ImageUploadRow = z.infer<typeof imageUploadRowSchema>;

// The queue job the edge enqueues for the container worker.
export const imageJobSchema = z.object({
  upload_id: uuid,
  store_id: uuid,
  key_pending: z.string().min(1)
});

export type ImageJob = z.infer<typeof imageJobSchema>;
