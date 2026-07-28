"use client";

import { useTransition } from "react";
import {
  signOutOtherSessionsAction,
  signOutEverywhereAction,
  resetMfaFactorAction,
} from "@/app/(app)/settings/security/actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SignOutOthersButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={() => startTransition(signOutOtherSessionsAction)}>
      {isPending ? "Signing out other sessions…" : "Sign out other sessions"}
    </Button>
  );
}

export function SignOutEverywhereButton() {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size="sm">
            Sign out everywhere
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of every session, including this one?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll need to sign back in and complete two-factor authentication again on every device.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void signOutEverywhereAction()}>Sign out everywhere</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ResetMfaButton() {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm">
            Start over
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this authenticator and set up a new one?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll be taken straight to setup for a new authenticator — the app requires MFA to be enrolled at
            all times.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void resetMfaFactorAction()}>Remove &amp; set up new</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
