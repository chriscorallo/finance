import "server-only";
import { z } from "zod";

/**
 * Server-only environment access. The `server-only` import makes any
 * accidental import from a client component a build-time error, so secrets
 * here can never end up in a browser bundle.
 */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  PROVIDER_TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(1)
    .describe("Base64-encoded 32-byte AES-256-GCM key used to encrypt Plaid access tokens at rest."),
  OWNER_EMAIL: z.email().describe("The single email address permitted to hold the owner account."),
  PLAID_ENV: z.enum(["sandbox", "development", "production"]).default("sandbox"),
  PLAID_CLIENT_ID: z.string().min(1).optional(),
  PLAID_SANDBOX_SECRET: z.string().min(1).optional(),
  PLAID_DEVELOPMENT_SECRET: z.string().min(1).optional(),
  PLAID_PRODUCTION_SECRET: z.string().min(1).optional(),
});

let cached: z.infer<typeof serverSchema> | null = null;

/** Lazily validated server-only environment. Never import this module from a client component. */
export function serverEnv() {
  if (!cached) {
    cached = serverSchema.parse({
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      PROVIDER_TOKEN_ENCRYPTION_KEY: process.env.PROVIDER_TOKEN_ENCRYPTION_KEY,
      OWNER_EMAIL: process.env.OWNER_EMAIL,
      PLAID_ENV: process.env.PLAID_ENV,
      PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID,
      PLAID_SANDBOX_SECRET: process.env.PLAID_SANDBOX_SECRET,
      PLAID_DEVELOPMENT_SECRET: process.env.PLAID_DEVELOPMENT_SECRET,
      PLAID_PRODUCTION_SECRET: process.env.PLAID_PRODUCTION_SECRET,
    });
  }
  return cached;
}
