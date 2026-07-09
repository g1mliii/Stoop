import { NextResponse } from "next/server";

// Legacy public diagnostic URL. The functional Sentry test is now under /admin/sentry-test so an
// unauthenticated request can never create monitoring events in preview deployments.
export function GET() {
  return NextResponse.json({ message: "Not found." }, { status: 404 });
}
