import "server-only";

import Stripe from "stripe";

import { requiredEnv } from "@/lib/env";

// Phase 5: single server-only Stripe client. Lazily instantiated and cached, mirroring the
// secret Supabase client (lib/supabase/secret.ts) so the key is read once and never reaches the
// browser. Pin the apiVersion to the SDK's generated default so a Stripe-side upgrade never
// silently changes request/response shapes under us.
const STRIPE_API_VERSION = "2026-05-27.dahlia";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  stripeClient = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
    apiVersion: STRIPE_API_VERSION,
    typescript: true
  });
  return stripeClient;
}
