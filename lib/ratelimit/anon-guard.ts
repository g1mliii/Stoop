import {
  addToWindows,
  getRateLimitKv,
  type RateLimitReservation
} from "@/lib/ratelimit/kv";
import { clientIp } from "@/lib/security/request-ip";
import { verifyTurnstile } from "@/lib/security/turnstile";

// Phase 9.3: the soft abuse-control gate shared by the anon order + subscribe server actions. Both
// resolve the edge IP, verify the Turnstile challenge, then reserve a per-(ip, store) + per-store
// KV window pair as one decision. Failed challenges must not consume a store's finite public-write
// capacity; otherwise an attacker could deny service without solving Turnstile. The orchestration is
// identical; only the keys/limits and the caller-facing copy differ, so callers pass a window builder
// and map the reason to their own message. KV-null (plain `next dev` / tests) fails open — the same
// soft-control contract as the rest of the limiter.

export type AnonGuardResult =
  | { ok: true }
  | { ok: false; reason: "turnstile" | "rate_limit" };

export async function guardAnonWrite(
  turnstileToken: string | undefined,
  buildWindows: (ip: string, now: number) => RateLimitReservation[]
): Promise<AnonGuardResult> {
  const ip = await clientIp();
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, reason: "turnstile" };
  }

  const kv = getRateLimitKv();
  if (kv) {
    const now = Date.now();
    const reservation = await addToWindows(kv, buildWindows(ip, now));
    if (!reservation.allowed) {
      return { ok: false, reason: "rate_limit" };
    }
  }

  return { ok: true };
}
