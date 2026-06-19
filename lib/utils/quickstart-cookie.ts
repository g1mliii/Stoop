import "server-only";

import { requiredEnv } from "@/lib/env";
import {
  pendingSignupSchema,
  type PendingSignup
} from "@/lib/schemas/signup";

// Phase 3.1/3.2: between requesting a signup magic link and the callback that creates the
// tenant, the quick-start payload lives in a short-lived signed cookie — NOT the database, so
// an abandoned signup never leaves orphan rows. The cookie is HMAC-signed (crypto.subtle) so
// the client can't tamper with the store name / price before we atomically create the store.

export const SIGNUP_COOKIE_NAME = "stoop_pending_signup";
export const SIGNUP_COOKIE_TTL_SECONDS = 30 * 60;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(requiredEnv("SIGNUP_COOKIE_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Constant-time comparison so a forged signature can't be probed byte-by-byte. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** Returns the signed cookie value `<payload>.<sig>` for a quick-start payload. */
export async function signPendingSignup(payload: PendingSignup): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(body))
  );
  return `${body}.${base64UrlEncode(sig)}`;
}

/**
 * Verifies signature + TTL + shape. Returns the payload, or null on any failure (tampered,
 * expired, malformed) — callers treat null as "no valid pending signup".
 */
export async function verifyPendingSignup(
  raw: string | undefined
): Promise<PendingSignup | null> {
  if (!raw) {
    return null;
  }
  const dot = raw.indexOf(".");
  if (dot <= 0) {
    return null;
  }
  const body = raw.slice(0, dot);
  const providedSig = raw.slice(dot + 1);

  try {
    const key = await hmacKey();
    const expectedSig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    );
    if (!timingSafeEqual(expectedSig, base64UrlDecode(providedSig))) {
      return null;
    }

    const parsed = pendingSignupSchema.safeParse(
      JSON.parse(decoder.decode(base64UrlDecode(body)))
    );
    if (!parsed.success) {
      return null;
    }
    if (Date.now() - parsed.data.issuedAt > SIGNUP_COOKIE_TTL_SECONDS * 1000) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
