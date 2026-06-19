"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { NUDGE_DISMISSED_COOKIE } from "@/lib/cookie-names";

// Phase 3.7: dismissal of the "print your QR" onboarding nudge. Persisted in a cookie (there is
// no scan-tracking column until Phase 7); the Orders page reads it server-side so there's no
// hydration flash. Phase 7 will also auto-retire the nudge once a first scan is recorded.

export async function dismissNudge(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(NUDGE_DISMISSED_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  revalidatePath("/dashboard/orders");
}
