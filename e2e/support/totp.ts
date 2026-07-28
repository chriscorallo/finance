import { generate } from "otplib";

/** Generates a TOTP code from a Base32 secret, the same way a real authenticator app would. */
export async function generateTotpCode(secret: string): Promise<string> {
  return generate({ secret });
}
