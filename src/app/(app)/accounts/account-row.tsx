"use client";

import { useState, useTransition } from "react";
import { MoreVertical, Loader2 } from "lucide-react";
import { archiveAccountAction } from "@/app/(app)/accounts/actions";
import { ACCOUNT_TYPE_META } from "@/lib/finance/account-type-meta";
import { formatCents } from "@/lib/finance/money";
import { isLiabilityAccountType } from "@/lib/finance/net-worth";
import type { AccountType } from "@/lib/supabase/database.types";
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

export type AccountRowData = {
  id: string;
  name: string;
  accountType: AccountType;
  mask: string | null;
  currentBalanceCents: number;
  includeInNetWorth: boolean;
};

export function AccountRow({ account }: { account: AccountRowData }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const meta = ACCOUNT_TYPE_META[account.accountType];
  const Icon = meta.icon;
  const isLiability = isLiabilityAccountType(account.accountType);

  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:px-6">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium">{account.name}</span>
          {account.mask ? (
            <span className="text-xs text-muted-foreground">•••{account.mask}</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{meta.label}</Badge>
          {!account.includeInNetWorth ? <Badge variant="secondary">Excluded</Badge> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className={"text-sm font-medium tabular-nums " + (isLiability ? "text-destructive" : "text-foreground")}>
          {isLiability ? "-" : ""}
          {formatCents(account.currentBalanceCents)}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${account.name}`}>
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              Archive account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {account.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides the account from your net worth and account list. Its history is kept and nothing is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await archiveAccountAction(account.id);
                  setConfirmOpen(false);
                });
              }}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
