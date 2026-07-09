import { NextResponse } from "next/server";

import { getQrGenerator } from "@/lib/cloudflare/bindings";
import type { QrGeneratorRequest } from "@/lib/qr/generator-request";
import { selectActiveBuilding } from "@/lib/queries/building-membership";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Phase 7.2: this remains the authenticated public route for QR downloads. The CPU-heavy QR/PDF
// work runs in an internal Worker so it does not inflate the OpenNext storefront bundle.

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;
  const format = searchParams.get("format") ?? "";
  const scope = searchParams.get("scope") === "building" ? "building" : "store";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  // RLS scopes this to the signed-in seller's own store.
  const { data: store } = await supabase
    .from("stores")
    .select("id, slug, name, description, visibility")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!store) {
    return NextResponse.json({ error: "Set up your store first." }, { status: 404 });
  }

  const generator = getQrGenerator();
  if (!generator) {
    return NextResponse.json(
      { error: "QR downloads aren't available right now. Try again in a moment." },
      { status: 503 }
    );
  }

  const payload: QrGeneratorRequest = {
    format,
    scope,
    store: {
      id: store.id,
      slug: store.slug,
      name: store.name,
      description: store.description,
      visibility: store.visibility
    }
  };

  if (scope === "building") {
    const { data: membership, error: membershipError } = await selectActiveBuilding(
      supabase,
      store.id
    );
    if (membershipError) {
      return NextResponse.json(
        { error: "We couldn't find your building bazaar." },
        { status: 500 }
      );
    }

    const building = membership?.buildings;
    if (!membership?.building_id || !building) {
      return NextResponse.json(
        { error: "Your stoop isn't grouped into a building yet." },
        { status: 404 }
      );
    }
    if (building.access_type === "invite" && !building.invite_code) {
      return NextResponse.json(
        { error: "Rotate the invite code before printing this poster." },
        { status: 409 }
      );
    }

    payload.building = {
      id: membership.building_id,
      publicSlug: building.public_slug,
      displayName: building.display_name,
      accessType: building.access_type,
      inviteCode: building.invite_code
    };
  }

  return generator.fetch(
    new Request("https://qr-generator.internal/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
  );
}
