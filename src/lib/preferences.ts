import "server-only";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_PREFERENCES = {
  privacyMode: false,
  theme: "system" as const,
};

/** Falls back to defaults when no row exists yet — the row is created lazily on first write. */
export async function getUserPreferences(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("privacy_mode, theme")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return DEFAULT_PREFERENCES;
  }

  return { privacyMode: data.privacy_mode, theme: data.theme };
}
