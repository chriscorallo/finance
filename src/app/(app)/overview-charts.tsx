import { TrendingUp, TrendingDown, CircleCheck, CircleAlert, TriangleAlert, CircleX } from "lucide-react";
import { formatCents } from "@/lib/finance/money";
import type { AllocationBucket } from "@/lib/finance/allocation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function NetWorthHero({ netWorthCents }: { netWorthCents: number }) {
  const isPositive = netWorthCents >= 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">Net worth</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-semibold sm:text-5xl ${isPositive ? "text-positive" : "text-negative"}`}>
          {formatCents(netWorthCents)}
        </span>
        {isPositive ? (
          <TrendingUp className="size-5 text-positive" aria-hidden="true" />
        ) : (
          <TrendingDown className="size-5 text-negative" aria-hidden="true" />
        )}
      </div>
      <span className="text-sm text-muted-foreground">
        {isPositive ? "You own more than you owe" : "You owe more than you own"}
      </span>
    </div>
  );
}

/** A diverging bar: assets extend right (positive), liabilities extend left (negative), from a shared zero baseline. */
export function AssetsLiabilitiesBar({
  assetsCents,
  liabilitiesCents,
}: {
  assetsCents: number;
  liabilitiesCents: number;
}) {
  const max = Math.max(assetsCents, liabilitiesCents, 1);
  const assetsPct = (assetsCents / max) * 100;
  const liabilitiesPct = (liabilitiesCents / max) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>Assets</span>
        <span className="text-right">Liabilities</span>
      </div>
      <div className="flex h-6 items-center gap-0.5">
        <div className="flex h-full flex-1 items-center justify-end">
          <div
            className="h-6 rounded-l-[4px] bg-negative"
            style={{ width: `${liabilitiesPct}%` }}
            role="img"
            aria-label={`Liabilities: ${formatCents(liabilitiesCents)}`}
          />
        </div>
        <div className="h-6 w-px shrink-0 bg-border" />
        <div className="flex h-full flex-1 items-center">
          <div
            className="h-6 rounded-r-[4px] bg-positive"
            style={{ width: `${assetsPct}%` }}
            role="img"
            aria-label={`Assets: ${formatCents(assetsCents)}`}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm font-medium tabular-nums">
        <span className="text-negative">{formatCents(liabilitiesCents)}</span>
        <span className="text-right text-positive">{formatCents(assetsCents)}</span>
      </div>
    </div>
  );
}

export function AllocationBarList({
  title,
  buckets,
  totalCents,
}: {
  title: string;
  buckets: AllocationBucket[];
  totalCents: number;
}) {
  if (buckets.length === 0) return null;
  const max = Math.max(...buckets.map((b) => b.cents), 1);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="flex flex-col gap-2">
        {buckets.map((bucket) => {
          const widthPct = (bucket.cents / max) * 100;
          const sharePct = totalCents > 0 ? Math.round((bucket.cents / totalCents) * 100) : 0;
          return (
            <Tooltip key={bucket.key}>
              <TooltipTrigger
                render={
                  <div className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted sm:gap-3">
                    <span className="w-16 shrink-0 truncate text-sm text-foreground sm:w-28">{bucket.label}</span>
                    <div className="h-4 flex-1">
                      <div
                        className="h-4 rounded-[4px]"
                        style={{ width: `${widthPct}%`, backgroundColor: `var(${bucket.colorVar})` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums sm:w-24">
                      {formatCents(bucket.cents)}
                    </span>
                  </div>
                }
              />
              <TooltipContent>
                {bucket.label}: {formatCents(bucket.cents)} ({sharePct}% of total)
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

const UTILIZATION_THRESHOLDS = [
  { max: 0.3, label: "Good", icon: CircleCheck, colorVar: "--positive" },
  { max: 0.7, label: "Getting high", icon: CircleAlert, colorVar: "--warning" },
  { max: 1, label: "High", icon: TriangleAlert, colorVar: "--serious" },
  { max: Infinity, label: "Over limit", icon: CircleX, colorVar: "--critical" },
] as const;

export function CreditUtilizationMeter({
  name,
  balanceCents,
  limitCents,
}: {
  name: string;
  balanceCents: number;
  limitCents: number;
}) {
  const ratio = limitCents > 0 ? balanceCents / limitCents : 0;
  const tier = UTILIZATION_THRESHOLDS.find((t) => ratio <= t.max) ?? UTILIZATION_THRESHOLDS[UTILIZATION_THRESHOLDS.length - 1];
  const Icon = tier.icon;
  const pct = Math.min(ratio * 100, 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-foreground">{name}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs" style={{ color: `var(${tier.colorVar})` }}>
          <Icon className="size-3.5" aria-hidden="true" />
          {tier.label}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full transition-[width]"
          style={{ width: `${pct}%`, backgroundColor: `var(${tier.colorVar})` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatCents(balanceCents)} used</span>
        <span>{formatCents(limitCents)} limit</span>
      </div>
    </div>
  );
}
