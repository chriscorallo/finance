"use client";

import { useState, useTransition } from "react";
import { Landmark, RefreshCw, MoreVertical, Loader2, CircleAlert } from "lucide-react";
import { syncInstitutionAction, disconnectInstitutionAction } from "@/app/(app)/accounts/plaid-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export type InstitutionRowData = {
  id: string;
  name: string;
  status: "active" | "error" | "disconnected";
  lastSuccessfulSyncAt: string | null;
  errorMessage: string | null;
};

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never synced";
  return `Synced ${new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

export function InstitutionRow({ institution }: { institution: InstitutionRowData }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSyncing, startSync] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSync() {
    setError(null);
    startSync(async () => {
      const result = await syncInstitutionAction(institution.id);
      setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Landmark className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{institution.name}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {institution.status === "error" ? (
            <Badge variant="destructive" className="gap-1">
              <CircleAlert className="size-3" /> Sync failed
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{formatSyncTime(institution.lastSuccessfulSyncAt)}</span>
          )}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Sync now" onClick={handleSync} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${institution.name}`}>
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {institution.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This stops syncing and archives its accounts. Your account history is kept — nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDisconnecting}
              onClick={() => {
                startDisconnect(async () => {
                  await disconnectInstitutionAction(institution.id);
                  setConfirmOpen(false);
                });
              }}
            >
              {isDisconnecting ? <Loader2 className="size-4 animate-spin" /> : null}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
