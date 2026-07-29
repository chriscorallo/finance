import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { buildGoogleAuthUrl } from "@/lib/calendar/google-client";
import { clientEnv } from "@/lib/env.client";

export async function GET() {
  await requireUser();

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("calendar_oauth_state_google", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${clientEnv.NEXT_PUBLIC_APP_URL}/api/calendar/google/callback`;
  return NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));
}
