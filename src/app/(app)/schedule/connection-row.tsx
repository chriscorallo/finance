"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Loader2, CircleAlert, RefreshCw } from "lucide-react";
import { syncCalendarConnectionAction, disconnectCalendarConnectionAction } from "@/app/(app)/schedule/actions";
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

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  microsoft: "Outlook",
  apple: "Apple",
};

export type ConnectionRowData = {
  id: string;
  provider: "google" | "microsoft" | "apple";
  displayName: string | null;
  status: "active" | "error" | "disconnected";
  lastSuccessfulSyncAt: string | null;
  colorVar: string;
};

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Never synced";
  return `Synced ${new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
}

export function ConnectionRow({ connection }: { connection: ConnectionRowData }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSyncing, startSync] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSync() {
    setError(null);
    startSync(async () => {
      const result = await syncCalendarConnectionAction(connection.id);
      setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: `var(${connection.colorVar})` }}
        aria-hidden="true"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">
          {connection.displayName ?? PROVIDER_LABEL[connection.provider]}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {connection.status === "error" ? (
            <Badge variant="destructive" className="gap-1">
              <CircleAlert className="size-3" /> Sync failed
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{formatSyncTime(connection.lastSuccessfulSyncAt)}</span>
          )}
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Sync ${connection.displayName ?? PROVIDER_LABEL[connection.provider]} now`}
          onClick={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Connection actions">
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
            <AlertDialogTitle>
              Disconnect {connection.displayName ?? PROVIDER_LABEL[connection.provider]}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This stops syncing and removes its cached events from this app. Nothing is deleted from the actual
              calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDisconnecting}
              onClick={() => {
                startDisconnect(async () => {
                  await disconnectCalendarConnectionAction(connection.id);
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
