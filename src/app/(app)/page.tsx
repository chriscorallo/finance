import Link from "next/link";
import { LayoutDashboard, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { calculateNetWorth } from "@/lib/finance/net-worth";
import { formatCents } from "@/lib/finance/money";
import type { AccountType } from "@/lib/supabase/database.types";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddAccountDialog } from "@/app/(app)/accounts/add-account-dialog";
import { AccountRow } from "@/app/(app)/accounts/account-row";

export default async function OverviewPage() {
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

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md items-center py-10 text-center">
          <CardHeader className="items-center">
            <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <LayoutDashboard className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <CardTitle>Your financial snapshot</CardTitle>
            <CardDescription>
              Net worth, cash flow, and safe-to-spend will appear here once you add an account.
            </CardDescription>
          </CardHeader>
          <div className="px-4">
            <AddAccountDialog />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Your financial snapshot, from manually tracked accounts.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Net worth</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCents(netWorth.netWorthCents)}</CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Liquid net worth</CardDescription>
            <CardTitle className="text-xl tabular-nums">{formatCents(netWorth.liquidNetWorthCents)}</CardTitle>
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

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-medium">Accounts</h2>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            render={
              <Link href="/accounts">
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
        </div>
        <Card className="py-0">
          {rows.slice(0, 6).map((row) => (
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
      </div>
    </div>
  );
}
