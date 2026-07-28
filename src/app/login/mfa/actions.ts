"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit/log";

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app.") });

export type MfaChallengeState = { error: string } | null;

export async function verifyMfaChallengeAction(
  _prevState: MfaChallengeState,
  formData: FormData,
): Promise<MfaChallengeState> {
  const user = await requireUser();
  const parsed = codeSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid code." };
  }

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = (factors?.totp ?? []).find((f) => f.status === "verified");

  if (!factor) {
    redirect("/login/mfa-setup");
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data.code });
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = headerList.get("user-agent");

  if (error) {
    await writeAuditEvent({ userId: user.id, eventType: "mfa_challenge_failed", ip, userAgent });
    return { error: "That code didn't work. Check the time on your device and try again." };
  }

  redirect("/");
}
