"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseDollarsToCents } from "@/lib/finance/money";
import { ACCOUNT_TYPES } from "@/lib/supabase/database.types";

const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  accountType: z.enum(ACCOUNT_TYPES),
  balance: z.string().min(1, "Balance is required"),
  mask: z.string().trim().max(4).optional(),
  interestRate: z.string().trim().optional(),
  creditLimit: z.string().trim().optional(),
  includeInNetWorth: z.boolean(),
  includeInLiquidNetWorth: z.boolean(),
  notes: z.string().trim().max(1000).optional(),
});

export type AccountActionState = { error: string } | null;

function parseAccountForm(formData: FormData) {
  return accountFormSchema.safeParse({
    name: formData.get("name"),
    accountType: formData.get("accountType"),
    balance: formData.get("balance"),
    mask: formData.get("mask") || undefined,
    interestRate: formData.get("interestRate") || undefined,
    creditLimit: formData.get("creditLimit") || undefined,
    includeInNetWorth: formData.get("includeInNetWorth") === "on",
    includeInLiquidNetWorth: formData.get("includeInLiquidNetWorth") === "on",
    notes: formData.get("notes") || undefined,
  });
}

export async function createAccountAction(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const user = await requireUser();
  const parsed = parseAccountForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  let balanceCents: number;
  try {
    balanceCents = parseDollarsToCents(parsed.data.balance);
  } catch {
    return { error: "Enter a valid balance amount." };
  }

  // Liability balances are stored as a positive magnitude (the amount
  // owed) — see src/lib/finance/net-worth.ts for why.
  balanceCents = Math.abs(balanceCents);

  let creditLimitCents: number | null = null;
  if (parsed.data.creditLimit) {
    try {
      creditLimitCents = Math.abs(parseDollarsToCents(parsed.data.creditLimit));
    } catch {
      return { error: "Enter a valid credit limit amount." };
    }
  }

  const interestRate = parsed.data.interestRate ? Number(parsed.data.interestRate) : null;
  if (interestRate !== null && (Number.isNaN(interestRate) || interestRate < 0 || interestRate > 100)) {
    return { error: "Enter a valid interest rate between 0 and 100." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: parsed.data.name,
    account_type: parsed.data.accountType,
    current_balance_cents: balanceCents,
    mask: parsed.data.mask || null,
    interest_rate: interestRate !== null ? interestRate.toFixed(4) : null,
    credit_limit_cents: creditLimitCents,
    is_manual: true,
    include_in_net_worth: parsed.data.includeInNetWorth,
    include_in_liquid_net_worth: parsed.data.includeInLiquidNetWorth,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { error: "Could not save this account. Please try again." };
  }

  revalidatePath("/accounts");
  revalidatePath("/");
  return null;
}

export async function archiveAccountAction(accountId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  await supabase
    .from("accounts")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("user_id", user.id);

  revalidatePath("/accounts");
  revalidatePath("/");
}
