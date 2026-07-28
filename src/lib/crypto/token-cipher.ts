import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

/**
 * AES-256-GCM encryption for provider (Plaid) access tokens before they're
 * stored in `encrypted_provider_tokens`. Uses Node's built-in, audited
 * `node:crypto` — no custom cryptography. The key is a base64-encoded
 * 32-byte secret from PROVIDER_TOKEN_ENCRYPTION_KEY, which must never leave
 * the server process.
 *
 * Ciphertext format: base64(iv[12] || authTag[16] || ciphertext).
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = Buffer.from(serverEnv().PROVIDER_TOKEN_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("PROVIDER_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return key;
}

export function encryptProviderToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptProviderToken(encoded: string): string {
  const key = getKey();
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
