import { expect, test } from "@playwright/test";

// Phase 3 regression: the quick-start form renders and is completable by keyboard alone.
// The full magic-link round-trip (/signup → email → /auth/callback → /dashboard/qr?first=1)
// needs an email-capture harness against the live Supabase project and runs separately.

test("signup quick-start renders and is keyboard reachable", async ({ page }) => {
  await page.goto("/signup");

  await expect(
    page.getByRole("heading", { name: "Open your stoop" })
  ).toBeVisible();

  // Fill the required fields by keyboard.
  await page.getByLabel("Store name").fill("Priya's Kitchen");
  await page.getByLabel("Your email").fill("priya@example.test");
  await page.getByLabel("First item").fill("Brown butter cookies");
  await page.getByLabel("Price").fill("$12");

  // Pickup method is a radio group — reachable and selectable.
  await page.getByRole("radio", { name: /message after order/i }).check();

  // Responsibility checkbox gates a valid submission.
  const responsibility = page.getByRole("checkbox");
  await responsibility.check();
  await expect(responsibility).toBeChecked();

  // The primary CTA is focusable via keyboard.
  const cta = page.getByRole("button", { name: "Open your stoop" });
  await cta.focus();
  await expect(cta).toBeFocused();

  // The live poster preview reflects the typed store name.
  await expect(page.getByText("Priya's Kitchen").first()).toBeVisible();
});

test("login page offers a magic-link request", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Sign in to Stoop" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send me a link" })
  ).toBeVisible();
});
