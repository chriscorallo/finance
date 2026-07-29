import type { AccountType } from "@/lib/supabase/database.types";

/**
 * Buckets accounts into a small, fixed set of categories for the Overview
 * "snapshot" charts. Assets get distinct categorical identity (each bucket
 * is a genuinely different kind of thing you own); liabilities all share
 * one "debt" meaning, so they share one color and differ only by label —
 * see color-formula.md's "status vs categorical" rule: color encodes
 * identity for assets, sentiment (owed) for liabilities, never both mixed
 * in one chart.
 */
export type AllocationBucket = {
  key: string;
  label: string;
  cents: number;
  /** CSS custom-property name (without var()) to color this bucket's bar. */
  colorVar: string;
};

const ASSET_BUCKETS: { key: string; label: string; colorVar: string; types: ReadonlySet<AccountType> }[] = [
  { key: "cash", label: "Cash", colorVar: "--series-1", types: new Set(["checking", "savings", "money_market"]) },
  {
    key: "investments",
    label: "Investments",
    colorVar: "--series-3",
    types: new Set(["brokerage", "retirement", "crypto"]),
  },
  {
    key: "property",
    label: "Property",
    colorVar: "--series-4",
    types: new Set(["real_estate", "vehicle", "business_equity"]),
  },
  { key: "other_assets", label: "Other assets", colorVar: "--series-7", types: new Set(["other_asset"]) },
];

const LIABILITY_BUCKETS: { key: string; label: string; types: ReadonlySet<AccountType> }[] = [
  { key: "credit_cards", label: "Credit cards", types: new Set(["credit_card"]) },
  {
    key: "loans",
    label: "Loans",
    types: new Set(["loan_personal", "loan_student", "loan_mortgage", "loan_auto"]),
  },
  { key: "other_debt", label: "Other debt", types: new Set(["other_liability"]) },
];

export type AllocationAccountInput = {
  accountType: AccountType;
  currentBalanceCents: number;
  includeInNetWorth: boolean;
};

/** Asset buckets (categorical color) with a nonzero balance, sorted largest first. */
export function bucketAssets(accounts: AllocationAccountInput[]): AllocationBucket[] {
  return ASSET_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    colorVar: bucket.colorVar,
    cents: accounts
      .filter((a) => a.includeInNetWorth && bucket.types.has(a.accountType))
      .reduce((sum, a) => sum + Math.abs(a.currentBalanceCents), 0),
  })).filter((bucket) => bucket.cents > 0);
}

/** Liability buckets (all share the "negative" status color) with a nonzero balance, sorted largest first. */
export function bucketLiabilities(accounts: AllocationAccountInput[]): AllocationBucket[] {
  return LIABILITY_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    colorVar: "--negative",
    cents: accounts
      .filter((a) => a.includeInNetWorth && bucket.types.has(a.accountType))
      .reduce((sum, a) => sum + Math.abs(a.currentBalanceCents), 0),
  })).filter((bucket) => bucket.cents > 0);
}

export function sortByCentsDescending(buckets: AllocationBucket[]): AllocationBucket[] {
  return [...buckets].sort((a, b) => b.cents - a.cents);
}
