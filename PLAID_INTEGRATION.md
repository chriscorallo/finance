# Plaid Integration (design — implementation starts Phase 3)

No Plaid code exists yet. This document specifies the design agreed for
Phase 3 so the schema built in Phase 1 (`connected_institutions`,
`encrypted_provider_tokens`, `synchronization_jobs`,
`synchronization_errors`) matches what actually gets built.

## Prerequisite

The owner needs a free Plaid developer account with sandbox API keys before
Phase 3 starts — sign up at Plaid's dashboard and generate a **sandbox**
`client_id`/`secret`. Do not request production access until Phase 6
(production hardening) is complete and, ideally, an independent security
review has been done.

## Environments

Separate Plaid credentials per environment, matching `serverEnv().PLAID_ENV`
(`src/lib/env.server.ts`, already defined): `sandbox`, `development`,
`production`. Never mix — a sandbox `secret` must never be used against
production endpoints and vice versa. Store each in the corresponding Vercel
environment's encrypted env vars (see `DEPLOYMENT.md`).

## Products used

- **Transactions** — core transaction/account sync.
- **Liabilities** — credit card/loan/mortgage/student-loan detail (rates,
  minimum payments, due dates) feeding the `debts` table.
- **Investments** — brokerage/retirement holdings, where supported.
- **Balance/Assets** — where useful for accounts Transactions doesn't cover.

**Never enable Plaid Transfer or any money-movement product.** This is a
hard architectural constraint (`ARCHITECTURE.md`, `THREAT_MODEL.md`), not a
Phase 3 implementation detail — there is no scenario in this app's design
where requesting that product is correct.

## Token handling

1. Plaid Link (client-side) returns a `public_token` to the browser.
2. The browser sends the `public_token` to a server action/route handler —
   never handled or stored client-side beyond that single round trip.
3. The server exchanges it for an `access_token` via Plaid's
   `/item/public_token/exchange`.
4. The server encrypts the `access_token`
   (`src/lib/crypto/token-cipher.ts`, AES-256-GCM) and stores only the
   ciphertext in `encrypted_provider_tokens`.
5. The raw `access_token` is never logged, never returned to the browser,
   never included in an error message, and never persisted anywhere else.
6. Every subsequent Plaid API call decrypts the token in server-only code
   immediately before use and does not hold the plaintext beyond that call.

## Sync architecture

Built on **Vercel Workflow DevKit** (see `ARCHITECTURE.md` §7) rather than ad
hoc retry loops:

- Each sync is a workflow with idempotent steps (fetch page → upsert
  transactions → advance cursor), so a crash mid-sync resumes rather than
  re-processing from scratch or duplicating rows.
- `synchronization_jobs` tracks status/cursor/retry_count/records
  inserted-updated-removed per run; `synchronization_errors` captures
  failures with a redacted provider-error payload (never the raw Plaid error
  object verbatim, in case it embeds request details) and a safe, translated
  user-facing message.
- Webhooks land on a Route Handler, verified against Plaid's webhook
  signature scheme before being trusted, and are themselves
  idempotent/replay-safe (a duplicate webhook delivery must not double-process).
- Transaction upserts key off the existing unique index
  `(account_id, provider_transaction_id)` (`DATA_MODEL.md`) — re-running a
  sync is always safe.

## Account disconnection

See `SECURITY.md` "Account-disconnection procedure" — call Plaid's
`/item/remove`, then delete the corresponding `encrypted_provider_tokens`
row, then mark `connected_institutions.status = 'disconnected'`. Logged as
`institution_disconnected` in `audit_events`.

## Manual accounts

Institutions/accounts Plaid doesn't support (crypto, real estate, vehicles,
business equity, and anything else) use the existing `accounts` table with
`is_manual = true` and no `institution_id` — this path is built in Phase 2,
before Plaid exists at all, specifically so the financial-calculation logic
is validated against synthetic/manual data first (per the phase plan in
`ARCHITECTURE.md`).

## Testing

Sandbox-only until every security and integration test passes (per the
6-phase plan). Never use real production financial data in automated tests —
Plaid's sandbox provides synthetic test institutions/accounts/transactions
for exactly this purpose.
