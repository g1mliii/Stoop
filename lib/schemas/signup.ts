import { z } from "zod";

import { cents, email } from "./common";
import { pickupMethodSchema } from "./store";

// Phase 3.1: the quick-start form. This is the only place a seller account is born, so the
// schema is the single source of truth for the signup server action AND the signed cookie
// payload we stash between magic-link request and callback (see lib/utils/quickstart-cookie).

export const signupQuickstartSchema = z.object({
  storeName: z.string().trim().min(1, "Give your stoop a name.").max(80),
  email: email,
  itemName: z.string().trim().min(1, "Name your first item.").max(120),
  // A blank or unparseable price comes through as 0 (parsePriceToCents); require a real amount so
  // the form surfaces an error instead of silently opening a $0 stoop.
  priceCents: cents.min(1, "Add a price for your first item."),
  pickupMethod: pickupMethodSchema,
  // Load-bearing: this is how the no-Stripe-Tax / compliance responsibility is disclosed at
  // signup. The box must be checked — a literal true, not just truthy.
  responsibilityAccepted: z.literal(true, {
    message: "Please accept the responsibility note to continue."
  })
});

export type SignupQuickstart = z.infer<typeof signupQuickstartSchema>;

// The cookie carries everything needed to create the tenant in the callback, minus the
// email (the session's verified email is authoritative there) plus an issued-at stamp.
export const pendingSignupSchema = signupQuickstartSchema
  .omit({ email: true, responsibilityAccepted: true })
  .extend({ issuedAt: z.number().int().positive() });

export type PendingSignup = z.infer<typeof pendingSignupSchema>;
