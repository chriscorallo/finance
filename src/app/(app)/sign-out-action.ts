"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { writeAuditEvent } from "@/lib/audit/log";

export async function signOutAction() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  await writeAuditEvent({ userId: user.id, eventType: "session_revoked", eventData: { scope: "local", reason: "user_sign_out" } });
  redirect("/login");
}
