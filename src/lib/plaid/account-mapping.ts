import { AccountSubtype, AccountType as PlaidAccountType } from "plaid";
import type { AccountType } from "@/lib/supabase/database.types";

/** Maps a Plaid account's type/subtype onto this app's AccountType enum. Subtype takes priority when it maps cleanly; otherwise falls back by broad type. */
export function mapPlaidAccountType(type: PlaidAccountType, subtype: AccountSubtype | null): AccountType {
  switch (subtype) {
    case AccountSubtype.Checking:
      return "checking";
    case AccountSubtype.Savings:
      return "savings";
    case AccountSubtype.MoneyMarket:
      return "money_market";
    case AccountSubtype.CreditCard:
      return "credit_card";
    case AccountSubtype.Mortgage:
      return "loan_mortgage";
    case AccountSubtype.Student:
      return "loan_student";
    case AccountSubtype.Auto:
      return "loan_auto";
    case AccountSubtype.Brokerage:
      return "brokerage";
    case AccountSubtype.CryptoExchange:
      return "crypto";
    default:
      break;
  }

  switch (type) {
    case PlaidAccountType.Credit:
      return "other_liability";
    case PlaidAccountType.Loan:
      return "loan_personal";
    case PlaidAccountType.Investment:
      // Most non-brokerage investment subtypes are retirement vehicles (401k, IRA, pension, HSA, etc.).
      return "retirement";
    case PlaidAccountType.Brokerage:
      return "brokerage";
    case PlaidAccountType.Depository:
    case PlaidAccountType.Other:
    default:
      return "other_asset";
  }
}
