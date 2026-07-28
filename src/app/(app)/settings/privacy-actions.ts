"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function setPrivacyModePreference(privacyMode: boolean) {
  const user = await requireUser();
  const supabase = await createClient();

  await supabase.from("user_preferences").upsert(
    { user_id: user.id, privacy_mode: privacyMode },
    { onConflict: "user_id" },
  );
}
