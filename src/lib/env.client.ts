import { z } from "zod";

/**
 * Env vars safe to bundle into the browser. Never add a secret here —
 * anything in this file ships in the client JS bundle.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

// The Vercel Marketplace Supabase integration prefixes injected vars with
// the storage resource's name (here, the "finance" Supabase resource
// connected to this project) to avoid collisions if more than one Supabase
// project were ever connected — it does not overwrite plain-named vars that
// already exist. Accept both the plain names and this resource's prefixed
// names, and both the legacy ("anon key") and current ("publishable key")
// Supabase naming, rather than requiring a manual rename in the dashboard.
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_finance_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_finance_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_finance_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
