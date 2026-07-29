"use server";

import { revalidatePath } from "next/cache";
import { CountryCode, ItemRemoveReasonCode, Products } from "plaid";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlaidClient } from "@/lib/plaid/client";
import { mapPlaidAccountType } from "@/lib/plaid/account-mapping";
import { isLiabilityAccountType } from "@/lib/finance/net-worth";
import { encryptProviderToken, decryptProviderToken } from "@/lib/crypto/token-cipher";
import { writeAuditEvent } from "@/lib/audit/log";

function centsFromDollars(amount: number | null): number {
  return amount === null ? 0 : Math.round(amount * 100);
}

export async function createLinkTokenAction(): Promise<{ linkToken: string | null; error: string | null }> {
  const user = await requireUser();

  try {
    const plaid = getPlaidClient();
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Personal Finance Command Center",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return { linkToken: response.data.link_token, error: null };
  } catch {
    return { linkToken: null, error: "Could not start the bank connection. Try again in a moment." };
  }
}

export async function exchangePublicTokenAction(publicToken: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const plaid = getPlaidClient();

  let accessToken: string;
  try {
    const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken });
    accessToken = exchange.data.access_token;
  } catch {
    return { error: "Could not finish connecting that bank. Try again." };
  }

  try {
    const accountsResponse = await plaid.accountsGet({ access_token: accessToken });
    const { accounts, item } = accountsResponse.data;

    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: institution, error: institutionError } = await supabase
      .from("connected_institutions")
      .insert({
        user_id: user.id,
        provider: "plaid",
        provider_institution_id: item.institution_id ?? null,
        name: item.institution_name ?? "Connected bank",
        status: "active",
        last_successful_sync_at: new Date().toISOString(),
        last_attempted_sync_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (institutionError || !institution) {
      return { error: "Connected to your bank, but saving it failed. Please try again." };
    }

    const { error: tokenError } = await admin.from("encrypted_provider_tokens").insert({
      user_id: user.id,
      institution_id: institution.id,
      provider: "plaid",
      encrypted_access_token: encryptProviderToken(accessToken),
    });

    if (tokenError) {
      return { error: "Connected to your bank, but saving credentials failed. Please try again." };
    }

    const accountRows = accounts.map((account) => {
      const accountType = mapPlaidAccountType(account.type, account.subtype);
      const isLiability = isLiabilityAccountType(accountType);
      const currentBalanceCents = Math.abs(centsFromDollars(account.balances.current));

      return {
        user_id: user.id,
        institution_id: institution.id,
        provider_account_id: account.account_id,
        name: account.name,
        official_name: account.official_name,
        account_type: accountType,
        account_subtype: account.subtype,
        mask: account.mask,
        current_balance_cents: currentBalanceCents,
        available_balance_cents: account.balances.available === null ? null : centsFromDollars(account.balances.available),
        credit_limit_cents: isLiability && account.balances.limit !== null ? centsFromDollars(account.balances.limit) : null,
        is_manual: false,
        include_in_net_worth: true,
        include_in_liquid_net_worth: !isLiability && accountType !== "retirement" && accountType !== "brokerage",
        sync_status: "ok" as const,
        last_synced_at: new Date().toISOString(),
      };
    });

    const { error: accountsError } = await supabase.from("accounts").insert(accountRows);
    if (accountsError) {
      return { error: "Connected to your bank, but importing accounts failed. Please try again." };
    }

    await writeAuditEvent({
      userId: user.id,
      eventType: "institution_connected",
      eventData: { institutionId: institution.id, accountCount: accountRows.length },
    });
  } catch {
    return { error: "Connected to your bank, but importing your accounts failed. Please try again." };
  }

  revalidatePath("/accounts");
  revalidatePath("/");
  return { error: null };
}

export async function syncInstitutionAction(institutionId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: tokenRow } = await admin
    .from("encrypted_provider_tokens")
    .select("encrypted_access_token")
    .eq("institution_id", institutionId)
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    return { error: "This connection is missing its credentials. Try disconnecting and reconnecting." };
  }

  try {
    const accessToken = decryptProviderToken(tokenRow.encrypted_access_token);
    const plaid = getPlaidClient();
    const accountsResponse = await plaid.accountsGet({ access_token: accessToken });

    for (const account of accountsResponse.data.accounts) {
      const accountType = mapPlaidAccountType(account.type, account.subtype);
      const isLiability = isLiabilityAccountType(accountType);
      const currentBalanceCents = Math.abs(centsFromDollars(account.balances.current));

      await supabase
        .from("accounts")
        .update({
          current_balance_cents: currentBalanceCents,
          available_balance_cents: account.balances.available === null ? null : centsFromDollars(account.balances.available),
          credit_limit_cents: isLiability && account.balances.limit !== null ? centsFromDollars(account.balances.limit) : null,
          sync_status: "ok",
          last_synced_at: new Date().toISOString(),
        })
        .eq("institution_id", institutionId)
        .eq("provider_account_id", account.account_id)
        .eq("user_id", user.id);
    }

    await supabase
      .from("connected_institutions")
      .update({
        status: "active",
        last_successful_sync_at: new Date().toISOString(),
        last_attempted_sync_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq("id", institutionId)
      .eq("user_id", user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await supabase
      .from("connected_institutions")
      .update({
        status: "error",
        last_attempted_sync_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", institutionId)
      .eq("user_id", user.id);

    await writeAuditEvent({
      userId: user.id,
      eventType: "sync_failure",
      eventData: { institutionId },
    });

    return { error: "Sync failed. We'll show your last known balances until it succeeds." };
  }

  revalidatePath("/accounts");
  revalidatePath("/");
  return { error: null };
}

export async function disconnectInstitutionAction(institutionId: string): Promise<{ error: string | null }> {
  const user = await requireUser();
  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: tokenRow } = await admin
    .from("encrypted_provider_tokens")
    .select("id, encrypted_access_token")
    .eq("institution_id", institutionId)
    .eq("user_id", user.id)
    .single();

  if (tokenRow) {
    try {
      const accessToken = decryptProviderToken(tokenRow.encrypted_access_token);
      const plaid = getPlaidClient();
      await plaid.itemRemove({ access_token: accessToken, reason_code: ItemRemoveReasonCode.Other });
    } catch {
      // Continue disconnecting locally even if Plaid's /item/remove call fails —
      // the user's intent is to stop syncing, and a dangling Item at Plaid's
      // end is not worse than leaving it connected here.
    }

    await admin.from("encrypted_provider_tokens").delete().eq("id", tokenRow.id);
  }

  await supabase
    .from("connected_institutions")
    .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
    .eq("id", institutionId)
    .eq("user_id", user.id);

  await supabase
    .from("accounts")
    .update({ archived_at: new Date().toISOString() })
    .eq("institution_id", institutionId)
    .eq("user_id", user.id);

  await writeAuditEvent({
    userId: user.id,
    eventType: "institution_disconnected",
    eventData: { institutionId },
  });

  revalidatePath("/accounts");
  revalidatePath("/");
  return { error: null };
}
