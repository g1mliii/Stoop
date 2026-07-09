import {
  addToWindows,
  getRateLimitKv,
  type RateLimitReservation
} from "@/lib/ratelimit/kv";
import { clientIp } from "@/lib/security/request-ip";
import { verifyTurnstile } from "@/lib/security/turnstile";

// Phase 9.3: the soft abuse-control gate shared by the anon order + subscribe server actions. The
// per-(ip, store) window is reserved before Turnstile, so a scripted client cannot force unlimited
// siteverify calls. The store-wide window is only reserved after a successful challenge, so failed
// challenges cannot exhaust a store's public-write capacity. KV-null (plain `next dev` / tests) fails
// open — the same soft-control contract as the rest of the limiter.

export type AnonGuardResult =
  | { ok: true }
  | { ok: false; reason: "turnstile" | "rate_limit" };

export type AnonWriteWindows = {
  preTurnstile: RateLimitReservation[];
  postTurnstile: RateLimitReservation[];
};

export async function guardAnonWrite(
  turnstileToken: string | undefined,
  buildWindows: (ip: string, now: number) => AnonWriteWindows
): Promise<AnonGuardResult> {
  const ip = await clientIp();
  const kv = getRateLimitKv();
  const windows = buildWindows(ip, Date.now());
  if (kv) {
    const reservation = await addToWindows(kv, windows.preTurnstile);
    if (!reservation.allowed) {
      return { ok: false, reason: "rate_limit" };
    }
  }

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return { ok: false, reason: "turnstile" };
  }

  if (kv) {
    const reservation = await addToWindows(kv, windows.postTurnstile);
    if (!reservation.allowed) {
      return { ok: false, reason: "rate_limit" };
    }
  }

  return { ok: true };
}
