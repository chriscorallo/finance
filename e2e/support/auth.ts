import type { Page } from "@playwright/test";
import { generateTotpCode } from "./totp";

export async function signInAsOwner(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_OWNER_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("**/login/mfa");
  const code = await generateTotpCode(process.env.E2E_OWNER_TOTP_SECRET!);
  await page.getByLabel("Authenticator code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL("/");
}
