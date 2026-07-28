/**
 * One-time setup script: creates the single owner account via the Supabase
 * Admin API. Public sign-up is disabled in this app (see supabase/migrations
 * and Supabase Auth settings), so this is the only way to create the account
 * that will ever exist. Run once per environment, then never again —
 * the enforce_single_owner_trigger migration rejects any further inserts.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... OWNER_EMAIL=... OWNER_PASSWORD=... \
 *     pnpm exec tsx scripts/provision-owner.ts
 */
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const secretKey = requireEnv("SUPABASE_SECRET_KEY");
  const ownerEmail = requireEnv("OWNER_EMAIL");
  const ownerPassword = requireEnv("OWNER_PASSWORD");

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await admin.auth.admin.listUsers();
  if (existing.users.length > 0) {
    console.error(
      `Refusing to continue: ${existing.users.length} user(s) already exist. This app supports exactly one owner account.`,
    );
    process.exit(1);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
  });

  if (error || !data.user) {
    console.error("Failed to create owner account:", error?.message);
    process.exit(1);
  }

  console.log(`Owner account created: ${data.user.id} (${data.user.email})`);
  console.log("Next step: sign in at /login, then complete TOTP enrollment — it is required before any other page is reachable.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
