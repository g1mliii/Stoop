import { beforeEach, describe, expect, it } from "vitest";

import { signAdminSession, verifyAdminSession } from "@/lib/auth/admin-session";
import { signCookiePayload } from "@/lib/utils/signed-cookie";

beforeEach(() => {
  process.env.SIGNUP_COOKIE_SECRET = "test-secret-please-rotate-in-prod";
});

describe("admin session cookies", () => {
  it("accepts only the admin-audience cookie shape", async () => {
    const now = Date.now();
    const session = await signAdminSession(now);

    await expect(verifyAdminSession(session, now)).resolves.toBe(true);
  });

  it("rejects a valid signature from another cookie purpose", async () => {
    const signupShapedCookie = await signCookiePayload({ issuedAt: Date.now() });

    await expect(verifyAdminSession(signupShapedCookie, Date.now())).resolves.toBe(
      false
    );
  });
});
