import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env.client";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Service-role client that bypasses Row Level Security. NEVER import this
 * outside of the narrow set of trusted server-only paths that legitimately
 * need cross-user or admin-level access (owner provisioning script, webhook
 * ingestion, scheduled sync jobs). Every call site using this client must be
 * paired with an explicit, hand-checked authorization condition in code,
 * since RLS is not there to catch a mistake.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createSupabaseClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
