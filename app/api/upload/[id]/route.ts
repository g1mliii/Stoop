import { NextResponse } from "next/server";

import { imageUploadPublicUrl } from "@/lib/actions/images";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Phase 3.5 step C (backend): the client polls this until the container worker flips the row to
// ready/rejected. RLS scopes the read to the owning seller.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("image_uploads")
    .select("id, status, key_final, reason")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    status: data.status,
    url: imageUploadPublicUrl(data.key_final),
    reason: data.reason
  });
}
