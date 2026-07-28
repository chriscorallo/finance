"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { verifyMfaChallengeAction, type MfaChallengeState } from "@/app/login/mfa/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Verifying…" : "Verify"}
    </Button>
  );
}

export function MfaChallengeForm() {
  const [state, formAction] = useActionState<MfaChallengeState, FormData>(verifyMfaChallengeAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Authenticator code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          required
          autoFocus
        />
      </div>
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <SubmitButton />
    </form>
  );
}
