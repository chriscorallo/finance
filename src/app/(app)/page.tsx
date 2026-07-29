import Link from "next/link";
import { LayoutDashboard, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { calculateNetWorth } from "@/lib/finance/net-worth";
import { formatCents } from "@/lib/finance/money";
import { bucketAssets, bucketLiabilities, sortByCentsDescending } from "@/lib/finance/allocation";
import type { AccountType } from "@/lib/supabase/database.types";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddAccountDialog } from "@/app/(app)/accounts/add-account-dialog";
import { AccountRow } from "@/app/(app)/accounts/account-row";
import {
  NetWorthHero,
  AssetsLiabilitiesBar,
  AllocationBarList,
  CreditUtilizationMeter,
} from "@/app/(app)/overview-charts";

export default async function OverviewPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select(
      "id, name, account_type, mask, current_balance_cents, credit_limit_cents, include_in_net_worth, include_in_liquid_net_worth",
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

  const allocationInput = rows.map((row) => ({
    accountType: row.account_type as AccountType,
    currentBalanceCents: row.current_balance_cents,
    includeInNetWorth: row.include_in_net_worth,
  }));
  const assetBuckets = sortByCentsDescending(bucketAssets(allocationInput));
  const liabilityBuckets = sortByCentsDescending(bucketLiabilities(allocationInput));

  const creditCards = rows.filter(
    (row) => row.account_type === "credit_card" && row.include_in_net_worth && (row.credit_limit_cents ?? 0) > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Your financial snapshot, from manually tracked accounts.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <NetWorthHero netWorthCents={netWorth.netWorthCents} />
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right sm:text-left">
            <div>
              <div className="text-xs text-muted-foreground">Liquid net worth</div>
              <div className="text-lg font-medium tabular-nums">{formatCents(netWorth.liquidNetWorthCents)}</div>
            </div>
          </div>
        </CardHeader>
        <div className="px-(--card-spacing) pb-(--card-spacing)">
          <AssetsLiabilitiesBar
            assetsCents={netWorth.totalAssetsCents}
            liabilitiesCents={netWorth.totalLiabilitiesCents}
          />
        </div>
      </Card>

      {assetBuckets.length > 0 || liabilityBuckets.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {assetBuckets.length > 0 ? (
            <Card>
              <div className="p-(--card-spacing)">
                <AllocationBarList
                  title="What you own"
                  buckets={assetBuckets}
                  totalCents={netWorth.totalAssetsCents}
                />
              </div>
            </Card>
          ) : null}
          {liabilityBuckets.length > 0 ? (
            <Card>
              <div className="p-(--card-spacing)">
                <AllocationBarList
                  title="What you owe"
                  buckets={liabilityBuckets}
                  totalCents={netWorth.totalLiabilitiesCents}
                />
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      {creditCards.length > 0 ? (
        <Card>
          <CardHeader>
            <CardDescription>Credit utilization</CardDescription>
          </CardHeader>
          <div className="flex flex-col gap-4 px-(--card-spacing) pb-(--card-spacing)">
            {creditCards.map((card) => (
              <CreditUtilizationMeter
                key={card.id}
                name={card.name}
                balanceCents={card.current_balance_cents}
                limitCents={card.credit_limit_cents ?? 0}
              />
            ))}
          </div>
        </Card>
      ) : null}

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
