import type { AccountType } from "@/lib/supabase/database.types";

/**
 * Account types that represent money owed, not money held. Balances for
 * these are stored as a positive magnitude (the amount owed) — the sign is
 * applied here, not in the database, so a credit card balance always reads
 * as "$500" (owed) rather than "-$500" throughout the UI.
 */
const LIABILITY_TYPES: ReadonlySet<AccountType> = new Set([
  "credit_card",
  "loan_personal",
  "loan_student",
  "loan_mortgage",
  "loan_auto",
  "other_liability",
]);

export function isLiabilityAccountType(type: AccountType): boolean {
  return LIABILITY_TYPES.has(type);
}

export type NetWorthAccountInput = {
  accountType: AccountType;
  currentBalanceCents: number;
  includeInNetWorth: boolean;
  includeInLiquidNetWorth: boolean;
};

export type NetWorthResult = {
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
  liquidNetWorthCents: number;
};

/**
 * Pure net-worth calculation over account balances. Respects
 * `includeInNetWorth`/`includeInLiquidNetWorth` per account, so an account
 * the owner has explicitly excluded (e.g. an estimated home value) never
 * silently affects the total.
 */
export function calculateNetWorth(accounts: NetWorthAccountInput[]): NetWorthResult {
  let totalAssetsCents = 0;
  let totalLiabilitiesCents = 0;
  let liquidNetWorthCents = 0;

  for (const account of accounts) {
    if (!account.includeInNetWorth) continue;

    const balance = Math.abs(account.currentBalanceCents);
    const isLiability = isLiabilityAccountType(account.accountType);

    if (isLiability) {
      totalLiabilitiesCents += balance;
    } else {
      totalAssetsCents += balance;
    }

    if (account.includeInLiquidNetWorth) {
      liquidNetWorthCents += isLiability ? -balance : balance;
    }
  }

  return {
    totalAssetsCents,
    totalLiabilitiesCents,
    netWorthCents: totalAssetsCents - totalLiabilitiesCents,
    liquidNetWorthCents,
  };
}
