import "server-only";

import { optionalEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient<Database>;

export function imageUploadPublicUrl(keyFinal: string | null): string | null {
  if (!keyFinal) {
    return null;
  }
  const base = optionalEnv("NEXT_PUBLIC_UPLOADS_BASE_URL");
  return base ? `${base.replace(/\/+$/, "")}/${keyFinal}` : null;
}

export async function resolveReadyImageUploadUrl(
  supabase: Db,
  storeId: string,
  uploadId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("image_uploads")
    .select("key_final, status")
    .eq("id", uploadId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error || !data || data.status !== "ready") {
    return {
      ok: false,
      error: "That photo is still processing — try again in a moment."
    };
  }

  const url = imageUploadPublicUrl(data.key_final);
  if (!url) {
    return {
      ok: false,
      error: "We couldn't attach that photo yet — try again in a moment."
    };
  }

  return { ok: true, url };
}
