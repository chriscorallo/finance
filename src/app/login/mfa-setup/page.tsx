import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMfaStatus, requireUser } from "@/lib/auth/session";
import { MfaSetupForm } from "@/app/login/mfa-setup/mfa-setup-form";

export const metadata: Metadata = {
  title: "Set up two-factor authentication",
};

export default async function MfaSetupPage() {
  await requireUser();
  const status = await getMfaStatus();

  if (status.state !== "no_factor_enrolled") {
    redirect(status.state === "verified" ? "/" : "/login/mfa");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Set up two-factor authentication</h1>
          <p className="text-sm text-muted-foreground">
            This app requires an authenticator app (like 1Password, Authy, or Google Authenticator) before you can
            continue.
          </p>
        </div>
        <MfaSetupForm />
      </div>
    </div>
  );
}
