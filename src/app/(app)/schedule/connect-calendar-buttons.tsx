"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { connectAppleCalendarAction } from "@/app/(app)/schedule/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

function ConnectAppleSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      Connect
    </Button>
  );
}

function ConnectAppleDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<{ error: string } | null, FormData>(async (prevState, formData) => {
    const result = await connectAppleCalendarAction(prevState, formData);
    if (!result) setOpen(false);
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full sm:w-auto" />}>
        Connect Apple Calendar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Apple Calendar</DialogTitle>
          <DialogDescription>
            Apple requires an app-specific password for third-party apps — generate one at{" "}
            <a href="https://appleid.apple.com" target="_blank" rel="noreferrer">
              appleid.apple.com
            </a>{" "}
            (under Sign-In and Security), then enter it below. Your regular Apple ID password won&apos;t work here.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="apple-email">Apple ID email</Label>
            <Input id="apple-email" name="email" type="email" required autoComplete="username" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="apple-app-password">App-specific password</Label>
            <Input
              id="apple-app-password"
              name="appPassword"
              type="password"
              placeholder="xxxx-xxxx-xxxx-xxxx"
              required
              autoComplete="off"
            />
          </div>
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <ConnectAppleSubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConnectCalendarButtons() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button variant="outline" className="w-full sm:w-auto" render={<Link href="/api/calendar/google/connect" />}>
        Connect Google
      </Button>
      <Button variant="outline" className="w-full sm:w-auto" render={<Link href="/api/calendar/microsoft/connect" />}>
        Connect Outlook
      </Button>
      <ConnectAppleDialog />
    </div>
  );
}
