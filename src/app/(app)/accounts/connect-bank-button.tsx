"use client";

import { useEffect, useState, useTransition } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";
import { Landmark, Loader2 } from "lucide-react";
import { createLinkTokenAction, exchangePublicTokenAction } from "@/app/(app)/accounts/plaid-actions";
import { Button } from "@/components/ui/button";

export function ConnectBankButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSuccess: PlaidLinkOnSuccess = (publicToken) => {
    if (!publicToken) return;
    startTransition(async () => {
      const result = await exchangePublicTokenAction(publicToken);
      setError(result.error);
      setLinkToken(null);
    });
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await createLinkTokenAction();
      if (result.error || !result.linkToken) {
        setError(result.error ?? "Could not start the bank connection.");
        return;
      }
      setLinkToken(result.linkToken);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" className="w-full gap-2 sm:w-auto" onClick={handleClick} disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Landmark className="size-4" />}
        Connect a bank
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
