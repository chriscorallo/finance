"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logMfaEnrolledAction } from "@/app/login/mfa-setup/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type EnrollState = { factorId: string; qrCodeDataUri: string; secret: string };

export function MfaSetupForm() {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollState | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.mfa
      .enroll({ factorType: "totp", friendlyName: "Authenticator app" })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setEnrollError(error?.message ?? "Could not start MFA enrollment.");
          return;
        }
        setEnrollment({
          factorId: data.id,
          qrCodeDataUri: `data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`,
          secret: data.totp.secret,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setVerifying(true);
    setVerifyError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code });

    if (error) {
      setVerifying(false);
      setVerifyError("That code didn't work. Check the time on your device and try again.");
      return;
    }

    await logMfaEnrolledAction();
    router.push("/");
    router.refresh();
  }

  if (enrollError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{enrollError}</AlertDescription>
      </Alert>
    );
  }

  if (!enrollment) {
    return (
      <div className="space-y-4">
        <Skeleton className="mx-auto h-48 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image can't optimize this */}
        <img src={enrollment.qrCodeDataUri} alt="Authenticator QR code" width={192} height={192} />
        <p className="text-center text-xs text-muted-foreground">
          Can&apos;t scan it? Enter this code manually:
        </p>
        <code className="rounded bg-muted px-2 py-1 text-xs tracking-wider">{enrollment.secret}</code>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Enter the 6-digit code to confirm</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
        />
      </div>

      {verifyError ? (
        <Alert variant="destructive">
          <AlertDescription>{verifyError}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="w-full" disabled={verifying || code.length !== 6}>
        {verifying ? "Confirming…" : "Confirm and enable"}
      </Button>
    </form>
  );
}
