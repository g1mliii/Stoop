import * as Sentry from "@sentry/nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, verifyAdminSession } from "@/lib/auth/admin-session";
import { appEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (
    appEnvironment === "production" ||
    !(await verifyAdminSession(session, Date.now()))
  ) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const eventId = Sentry.captureException(new Error("Stoop server Sentry test event"));

  return NextResponse.json(
    { eventId, message: "Sentry server test event captured." },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
