import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MINUTES = 15;
const FREE_ATTEMPTS = 4;
const MAX_LOCKOUT_MINUTES = 30;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Escalating-delay login throttle backed by `login_events`, so a brute-force
 * pass against the single owner account gets slower with every failure
 * instead of hitting the database at full speed. No external store needed —
 * the audit trail we already keep is the rate-limit state.
 *
 * Fails open on any infrastructure error, including `createAdminClient()`
 * itself throwing — this runs on every login attempt, so an unguarded
 * exception here would fail the entire sign-in flow, not just skip rate
 * limiting.
 */
export async function checkLoginRateLimit(email: string): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

    const { data, error } = await admin
      .from("login_events")
      .select("success, created_at")
      .eq("email", email.toLowerCase())
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) {
      return { allowed: true };
    }

    let consecutiveFailures = 0;
    for (const event of data) {
      if (!event.success) {
        consecutiveFailures += 1;
      } else {
        break;
      }
    }

    if (consecutiveFailures <= FREE_ATTEMPTS) {
      return { allowed: true };
    }

    const mostRecent = data[0];
    const lockoutMinutes = Math.min(2 ** (consecutiveFailures - FREE_ATTEMPTS - 1), MAX_LOCKOUT_MINUTES);
    const unlockAt = new Date(mostRecent.created_at).getTime() + lockoutMinutes * 60_000;
    const retryAfterSeconds = Math.ceil((unlockAt - Date.now()) / 1000);

    if (retryAfterSeconds <= 0) {
      return { allowed: true };
    }

    return { allowed: false, retryAfterSeconds };
  } catch {
    return { allowed: true };
  }
}
