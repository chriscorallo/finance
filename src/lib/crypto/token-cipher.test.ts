import { describe, it, expect, beforeAll, vi } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.SUPABASE_SECRET_KEY = "test-secret-key";
  process.env.OWNER_EMAIL = "owner@example.com";
});

describe("token-cipher", () => {
  it("round-trips plaintext through encrypt/decrypt", async () => {
    const { encryptProviderToken, decryptProviderToken } = await import("./token-cipher");
    const plaintext = "access-sandbox-1234567890abcdef";

    const encrypted = encryptProviderToken(plaintext);
    expect(encrypted).not.toContain(plaintext);

    const decrypted = decryptProviderToken(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext (random IV)", async () => {
    const { encryptProviderToken } = await import("./token-cipher");
    const a = encryptProviderToken("same-input");
    const b = encryptProviderToken("same-input");
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext", async () => {
    const { encryptProviderToken, decryptProviderToken } = await import("./token-cipher");
    const encrypted = encryptProviderToken("sensitive-value");

    const raw = Buffer.from(encrypted, "base64");
    raw[raw.length - 1] ^= 0xff; // flip the last byte of the ciphertext
    const tampered = raw.toString("base64");

    expect(() => decryptProviderToken(tampered)).toThrow();
  });

  it("rejects a key that isn't 32 bytes", async () => {
    process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
    vi.resetModules();
    const cipher = await import("./token-cipher");
    expect(() => cipher.encryptProviderToken("x")).toThrow(/32 bytes/);
  });
});
