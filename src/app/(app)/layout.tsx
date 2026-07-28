import { requireFullyAuthenticated } from "@/lib/auth/session";
import { getUserPreferences } from "@/lib/preferences";
import { PrivacyModeProvider } from "@/components/privacy/privacy-mode-provider";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireFullyAuthenticated();
  const preferences = await getUserPreferences(user.id);

  return (
    <PrivacyModeProvider initialValue={preferences.privacyMode}>
      <AppShell userEmail={user.email ?? "Account"}>{children}</AppShell>
    </PrivacyModeProvider>
  );
}
