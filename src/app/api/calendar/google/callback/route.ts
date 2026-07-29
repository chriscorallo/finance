import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeGoogleCode, fetchGoogleAccountEmail } from "@/lib/calendar/google-client";
import { encryptProviderToken } from "@/lib/crypto/token-cipher";
import { writeAuditEvent } from "@/lib/audit/log";
import { clientEnv } from "@/lib/env.client";

function redirectToSchedule(path: string) {
  return NextResponse.redirect(new URL(path, clientEnv.NEXT_PUBLIC_APP_URL));
}

export async function GET(request: NextRequest) {
  const user = await requireUser();

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("calendar_oauth_state_google")?.value;
  cookieStore.delete("calendar_oauth_state_google");

  if (oauthError || !code || !state || state !== expectedState) {
    return redirectToSchedule("/schedule?error=google_connect_failed");
  }

  try {
    const redirectUri = `${clientEnv.NEXT_PUBLIC_APP_URL}/api/calendar/google/callback`;
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const email = await fetchGoogleAccountEmail(tokens.accessToken);

    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: connection, error: connectionError } = await supabase
      .from("calendar_connections")
      .insert({
        user_id: user.id,
        provider: "google",
        provider_account_email: email,
        display_name: email ? `Google — ${email}` : "Google Calendar",
        status: "active",
        last_successful_sync_at: new Date().toISOString(),
        last_attempted_sync_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (connectionError || !connection) {
      return redirectToSchedule("/schedule?error=google_save_failed");
    }

    const { error: tokenError } = await admin.from("encrypted_calendar_tokens").insert({
      user_id: user.id,
      connection_id: connection.id,
      provider: "google",
      encrypted_access_token: encryptProviderToken(tokens.accessToken),
      encrypted_refresh_token: tokens.refreshToken ? encryptProviderToken(tokens.refreshToken) : null,
      access_token_expires_at: tokens.expiresAt,
    });

    if (tokenError) {
      return redirectToSchedule("/schedule?error=google_save_failed");
    }

    await writeAuditEvent({
      userId: user.id,
      eventType: "calendar_connected",
      eventData: { provider: "google", connectionId: connection.id },
    });
  } catch {
    return redirectToSchedule("/schedule?error=google_connect_failed");
  }

  return redirectToSchedule("/schedule");
}
