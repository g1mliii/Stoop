import { redirect } from "next/navigation";

// Returning dashboard loads land on Orders (new signups are routed to /dashboard/qr?first=1
// by the auth callback). Phase 3.3.
export default function DashboardIndex() {
  redirect("/dashboard/orders");
}
