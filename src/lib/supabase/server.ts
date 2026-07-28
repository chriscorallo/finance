import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env.client";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Use in Server Components, Server Actions, and Route Handlers.
 *
 * Server Components can't write cookies, so the `setAll` write silently
 * no-ops there; session refresh writes happen in `proxy.ts` instead, which
 * runs on every request and can write response cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component render — the middleware/proxy
            // session-refresh path handles the write instead.
          }
        },
      },
    },
  );
}
