"use server";

import { cookies } from "next/headers";

import { requestSignupMagicLink } from "@/lib/auth/magic-link";
import { screenStoreName } from "@/lib/security/store-name";
import {
  signupQuickstartSchema,
  type SignupQuickstart
} from "@/lib/schemas/signup";
import {
  SIGNUP_COOKIE_NAME,
  SIGNUP_COOKIE_TTL_SECONDS,
  signPendingSignup
} from "@/lib/utils/quickstart-cookie";

// Phase 3.1/3.2: the quick-start submit. No DB rows are created here — that happens
// atomically in the callback after the email is verified (lib/actions/signup → callback →
// create_store_quickstart RPC). This keeps an abandoned signup from leaving orphan rows.

export type SignupFieldErrors = Partial<
  Record<keyof SignupQuickstart, string>
>;

export type SignupResult =
  | { ok: true; message: string }
  | { ok: false; fieldErrors: SignupFieldErrors };

export async function startSignup(
  input: unknown
): Promise<SignupResult> {
  const parsed = signupQuickstartSchema.safeParse(input);
  if (!parsed.success) {
    // On validation failure we return field errors; the client keeps its own state so the
    // submitted values stay in place (3.2 — no separate draft flow).
    const fieldErrors: SignupFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key as keyof SignupQuickstart] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }

  const { email, storeName, itemName, priceCents, pickupMethod } = parsed.data;

  // Hard-block obvious slurs / obscenity before a magic link is ever sent. Borderline names are
  // allowed through here and soft-flagged to audit_log after the tenant is created (see the
  // auth callback) so a human can review them with a real store_id to act on.
  if (screenStoreName(storeName).action === "block") {
    return {
      ok: false,
      fieldErrors: { storeName: "That name won't work — try another one." }
    };
  }

  const cookieValue = await signPendingSignup({
    storeName,
    itemName,
    priceCents,
    pickupMethod,
    issuedAt: Date.now()
  });

  const cookieStore = await cookies();
  cookieStore.set(SIGNUP_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SIGNUP_COOKIE_TTL_SECONDS,
    path: "/"
  });

  const { message } = await requestSignupMagicLink(email);
  return { ok: true, message };
}
