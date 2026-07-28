import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

/**
 * Verifies the session against the Supabase auth server (getUser(), not the
 * cheaper local-only getClaims()) and redirects to /login if there's no
 * authenticated user. This only checks "is this a real, live session" — it
 * does NOT check MFA status. Use `requireFullyAuthenticated` for that.
 */
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}

export type MfaStatus =
  | { state: "no_factor_enrolled" }
  | { state: "needs_challenge" }
  | { state: "verified" };

export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = await createClient();

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = (factorsData?.totp ?? []).some((factor) => factor.status === "verified");

  if (!hasVerifiedFactor) {
    return { state: "no_factor_enrolled" };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") {
    return { state: "verified" };
  }

  return { state: "needs_challenge" };
}

/**
 * The gate every protected app route sits behind: a live session AND, since
 * this app requires MFA, a completed TOTP challenge. Redirects to the right
 * step (enroll vs. challenge) rather than a single generic /login bounce.
 */
export async function requireFullyAuthenticated(): Promise<User> {
  const user = await requireUser();
  const mfaStatus = await getMfaStatus();

  if (mfaStatus.state === "no_factor_enrolled") {
    redirect("/login/mfa-setup");
  }
  if (mfaStatus.state === "needs_challenge") {
    redirect("/login/mfa");
  }

  return user;
}

/**
 * Step-up check for sensitive actions (disconnect institution, export,
 * delete data, change security settings). Today this checks the same AAL2
 * condition as requireFullyAuthenticated — it does not yet verify the AAL2
 * challenge was *recent*, since Supabase's AAL API doesn't expose a
 * challenge timestamp. See SECURITY.md "Known limitations" for the
 * recency-based step-up follow-up.
 */
export async function requireAal2(): Promise<User> {
  return requireFullyAuthenticated();
}
