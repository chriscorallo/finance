"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { logMfaEnrolledAction } from "@/app/login/mfa-setup/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type EnrollState = { factorId: string; qrCodePngDataUri: string; secret: string };

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

    async function run() {
      // Every mount used to call enroll() unconditionally, which creates a
      // brand-new factor (new secret, new QR) each time — including on a
      // page refresh or a redeploy landing mid-setup. Any secret already
      // saved in an authenticator app from a previous mount then belonged
      // to an abandoned factor and could never verify. Clean up any
      // unverified TOTP factor from a previous attempt first, so there is
      // always exactly one live factor and the secret shown is always the
      // one that will actually work.
      // listFactors()'s per-type `totp` array only ever contains *verified*
      // factors (that's how the SDK types it) — unverified ones only show
      // up in `all`. Filter there instead, or this cleanup silently never
      // finds anything to clean up.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const factor of existing?.all ?? []) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      if (cancelled) return;

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (cancelled) return;

      if (error || !data) {
        setEnrollError(error?.message ?? "Could not start MFA enrollment.");
        return;
      }

      // Generate the QR code ourselves from the otpauth:// URI rather than
      // relying on Supabase's server-rendered SVG string embedded as a
      // data: URI — that produced a QR code that silently failed to render
      // for some users. `qrcode` is a well-established library; toDataURL()
      // always returns a valid PNG data URI.
      try {
        const qrCodePngDataUri = await QRCode.toDataURL(data.totp.uri, { width: 256, margin: 1 });
        if (cancelled) return;
        setEnrollment({ factorId: data.id, qrCodePngDataUri, secret: data.totp.secret });
      } catch {
        if (cancelled) return;
        // The secret is still shown for manual entry even if local QR
        // generation somehow fails, so enrollment can still complete.
        setEnrollment({ factorId: data.id, qrCodePngDataUri: "", secret: data.totp.secret });
      }
    }

    run();

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

    // The security-critical step (verifying the code) already succeeded
    // above. Logging that fact is best-effort — a hiccup here (env var,
    // network, anything) must never leave the user stuck on this screen
    // after they've already correctly enrolled.
    try {
      await logMfaEnrolledAction();
    } catch {
      // swallow — enrollment already succeeded regardless of this outcome
    }

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
        <Skeleton className="mx-auto h-64 w-64" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-lg border bg-card p-4">
        {enrollment.qrCodePngDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image can't optimize this
          <img
            src={enrollment.qrCodePngDataUri}
            alt="Authenticator QR code"
            width={256}
            height={256}
            className="rounded-md"
          />
        ) : null}
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
