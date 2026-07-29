import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth/session";
import { buildMicrosoftAuthUrl } from "@/lib/calendar/microsoft-client";
import { clientEnv } from "@/lib/env.client";

export async function GET() {
  await requireUser();

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("calendar_oauth_state_microsoft", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${clientEnv.NEXT_PUBLIC_APP_URL}/api/calendar/microsoft/callback`;
  return NextResponse.redirect(buildMicrosoftAuthUrl(redirectUri, state));
}
