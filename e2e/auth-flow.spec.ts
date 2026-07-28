import { test, expect } from "@playwright/test";
import { signInAsOwner } from "./support/auth";

/**
 * Owner login flow: password → MFA challenge → dashboard shell → privacy
 * mode → session revoke. Requires a seeded test Supabase project with a
 * pre-provisioned owner account and TOTP factor. Skips locally/in CI until
 * E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD, and E2E_OWNER_TOTP_SECRET are
 * configured — see TESTING.md for how to seed the sandbox project this
 * suite runs against.
 */
const hasCredentials =
  !!process.env.E2E_OWNER_EMAIL && !!process.env.E2E_OWNER_PASSWORD && !!process.env.E2E_OWNER_TOTP_SECRET;

test.skip(!hasCredentials, "E2E owner credentials are not configured — see TESTING.md");

test("owner can sign in, complete MFA, and reach the dashboard shell", async ({ page }) => {
  await signInAsOwner(page);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByText("Your financial snapshot")).toBeVisible();
});

test("privacy mode toggle updates its pressed state", async ({ page }) => {
  await signInAsOwner(page);

  const privacyToggle = page.getByRole("button", { name: /privacy mode/i });
  await expect(privacyToggle).toHaveAttribute("aria-pressed", "false");
  await privacyToggle.click();
  await expect(privacyToggle).toHaveAttribute("aria-pressed", "true");
});

test("owner can view and revoke sessions from the Security page", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/settings/security");

  await expect(page.getByText("This device")).toBeVisible();
  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  await page.getByRole("button", { name: "Sign out everywhere" }).last().click();

  await page.waitForURL("**/login");
});
