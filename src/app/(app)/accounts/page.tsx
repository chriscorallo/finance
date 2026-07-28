import { Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { calculateNetWorth } from "@/lib/finance/net-worth";
import { formatCents } from "@/lib/finance/money";
import type { AccountType } from "@/lib/supabase/database.types";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AddAccountDialog } from "@/app/(app)/accounts/add-account-dialog";
import { AccountRow } from "@/app/(app)/accounts/account-row";

export default async function AccountsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select(
      "id, name, account_type, mask, current_balance_cents, include_in_net_worth, include_in_liquid_net_worth",
    )
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  const rows = accounts ?? [];

  const netWorth = calculateNetWorth(
    rows.map((row) => ({
      accountType: row.account_type as AccountType,
      currentBalanceCents: row.current_balance_cents,
      includeInNetWorth: row.include_in_net_worth,
      includeInLiquidNetWorth: row.include_in_liquid_net_worth,
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">Manually tracked balances — Plaid sync arrives in a later phase.</p>
        </div>
        <AddAccountDialog />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Net worth</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCents(netWorth.netWorthCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Assets</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCents(netWorth.totalAssetsCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Liabilities</CardDescription>
            <CardTitle className="text-xl tabular-nums text-destructive">
              {formatCents(netWorth.totalLiabilitiesCents)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="items-center py-10 text-center">
          <CardHeader className="items-center">
            <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <Wallet className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle>No accounts yet</CardTitle>
            <CardDescription>Add a checking, savings, credit card, or any other account to start tracking net worth.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="py-0">
          {rows.map((row) => (
            <AccountRow
              key={row.id}
              account={{
                id: row.id,
                name: row.name,
                accountType: row.account_type as AccountType,
                mask: row.mask,
                currentBalanceCents: row.current_balance_cents,
                includeInNetWorth: row.include_in_net_worth,
              }}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
