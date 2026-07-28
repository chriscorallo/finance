"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { writeLoginEvent, writeAuditEvent } from "@/lib/audit/log";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginActionState = { error: string } | null;

async function getRequestMeta() {
  const headerList = await headers();
  return {
    ip: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerList.get("user-agent"),
  };
}

export async function signInAction(_prevState: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const { email, password } = parsed.data;
  const { ip, userAgent } = await getRequestMeta();

  const rateLimit = await checkLoginRateLimit(email);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
    return { error: `Too many failed attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Audit logging is best-effort — a failure here (env var hiccup,
    // transient DB issue) must never prevent the real error from reaching
    // the user, and must never leave the form stuck submitting.
    try {
      await writeLoginEvent({
        userId: null,
        email,
        success: false,
        failureReason: error?.message ?? "unknown_error",
        ip,
        userAgent,
      });
    } catch {
      // swallow — the actual auth failure below is what matters
    }
    return { error: "Invalid email or password." };
  }

  try {
    await writeLoginEvent({ userId: data.user.id, email, success: true, ip, userAgent });
    await writeAuditEvent({ userId: data.user.id, eventType: "login_success", ip, userAgent });
  } catch {
    // swallow — sign-in already succeeded regardless of this outcome
  }

  redirect("/");
}
