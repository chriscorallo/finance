import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMfaStatus, requireUser } from "@/lib/auth/session";
import { MfaChallengeForm } from "@/app/login/mfa/mfa-challenge-form";

export const metadata: Metadata = {
  title: "Verify it's you",
};

export default async function MfaChallengePage() {
  await requireUser();
  const status = await getMfaStatus();

  if (status.state === "no_factor_enrolled") {
    redirect("/settings/security/mfa-setup");
  }
  if (status.state === "verified") {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Verify it&apos;s you</h1>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app to finish signing in.
          </p>
        </div>
        <MfaChallengeForm />
      </div>
    </div>
  );
}
