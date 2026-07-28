"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAal2 } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit/log";

export async function signOutOtherSessionsAction() {
  const user = await requireAal2();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });

  if (!error) {
    await writeAuditEvent({ userId: user.id, eventType: "session_revoked", eventData: { scope: "others" } });
  }

  revalidatePath("/settings/security");
}

export async function signOutEverywhereAction() {
  const user = await requireAal2();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });

  if (!error) {
    await writeAuditEvent({ userId: user.id, eventType: "sessions_revoked_all", eventData: {} });
  }

  redirect("/login");
}

export async function resetMfaFactorAction() {
  const user = await requireAal2();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();

  for (const factor of factors?.totp ?? []) {
    await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  await writeAuditEvent({ userId: user.id, eventType: "mfa_unenrolled", eventData: {} });
  redirect("/login/mfa-setup");
}
