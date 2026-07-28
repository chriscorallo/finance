# Data Model

The migrations under `supabase/migrations/` are the source of truth; this
document is a guide to reading them, not a duplicate spec that can drift out
of sync. If this file and the SQL ever disagree, trust the SQL and fix this
file.

## Conventions (apply to every owned table)

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users (id)` — the sole ownership
  column; every RLS policy checks `auth.uid() = user_id`.
- `created_at timestamptz not null default now()`; `updated_at timestamptz`
  maintained by the shared `set_updated_at()` trigger
  (`0001_extensions_and_helpers.sql`) on every table that has one.
- **Money is always an integer minor-unit (cents) column**, named
  `..._cents`, `bigint`. Never `numeric`/`float` for money. Interest rates and
  percentages use `numeric(6,4)` (a real decimal type, not floating point),
  since they're not currency amounts but do need exact fractional precision.
- Timestamps are `timestamptz` (stored UTC, Postgres converts on the way
  in/out); plain `date` columns (transaction dates, due dates) are
  intentionally timezone-naive — a bill is "due on" a calendar date, not an
  instant.
- Soft-delete via `deleted_at timestamptz` where a row should be recoverable
  (currently only `transactions`); everything else is a hard delete, since the
  full "delete all my data" flow (Phase 2+) is expected to be destructive by
  design.
- Idempotent provider imports: `transactions` has a unique index on
  `(account_id, provider_transaction_id)` (partial, `where
  provider_transaction_id is not null`) so a re-run sync can't create
  duplicates — it should upsert on conflict.

## Table groups

### Security & audit (`0002_security_and_audit.sql`)

- `user_preferences` — one row per user; privacy mode, theme, AI/analytics
  opt-in flags, safe-to-spend mode, retention preference.
- `login_events` — append-only; every sign-in attempt, success or failure.
  Only the service-role client can insert; the owner can `select` their own.
- `audit_events` — append-only; every security-relevant action (see
  `SECURITY.md` for the event-type list). Same read/write split as above.
- `list_active_sessions()` — a `SECURITY DEFINER` SQL function (not a table)
  that exposes safe columns from `auth.sessions` (which `authenticated` has
  no direct grant on) filtered to the caller's own sessions. Deliberately not
  duplicated into an app-owned table, to avoid it drifting out of sync with
  Supabase's own session state.
- `enforce_single_owner_trigger` / `enforce_single_owner()` — not a table;
  a `BEFORE INSERT` trigger on `auth.users` rejecting any insert once one
  user already exists.

### Institutions & tokens (`0003_core_finance_schema.sql`)

- `connected_institutions` — one row per linked institution.
- `encrypted_provider_tokens` — access tokens, AES-256-GCM encrypted at the
  application layer; RLS enabled with **no** policies for `authenticated`
  (service-role only — see `SECURITY.md`).

### Accounts

- `accounts` — every account type in one table (`account_type` enum covers
  checking through `other_liability`), manual and provider-synced alike,
  distinguished by `is_manual`. Flags for whether a row counts toward net
  worth, liquid net worth, and spend calculations, since not every account
  should count toward all three (e.g. a mortgage counts toward net worth but
  never toward "spending").
- `account_balances` — historical balance snapshots (`as_of` date,
  `source`: sync/user_entered/estimated).

### Transactions & categorization

- `transaction_categories` — self-referencing (parent/child) user-defined
  categories.
- `transaction_category_rules` — deterministic rules engine input (merchant/
  description/account/amount-range → category), tried before any AI
  suggestion (Phase 2+ logic; schema exists now).
- `transactions` — the core ledger row. Notable flags: `is_transfer`,
  `is_reimbursement`, `is_refund`, `excluded_from_spending`,
  `excluded_from_cash_flow`, `business_or_personal`,
  `essential_or_discretionary`, `budget_class` (need/want/savings/debt),
  `category_confidence`. `deleted_at` for soft delete.
- `transaction_splits` — a transaction divided across multiple categories.
- `transaction_tags` — free-form tags, `unique(transaction_id, tag)`.

### Recurring, bills, calendar

- `recurring_items` / `recurring_occurrences` — detected or user-confirmed
  recurring charges/income and their individual expected occurrences.
- `bills` — a due-date-oriented view distinct from `recurring_items` (a bill
  can exist without being detected as a recurring pattern yet).
- `calendar_events` — the financial calendar; can reference a
  `recurring_item`, `bill`, or `goal`, or stand alone as a manually-planned
  entry (`is_manual_plan`).

### Goals & debts

- `goals` / `goal_contributions`.
- `debts` / `debt_terms` (a history of rate/payment changes) /
  `debt_scenarios` / `debt_scenario_payments` (a strategy's computed
  month-by-month payment schedule — `computed_result` also holds a cached
  jsonb summary for the strategy comparison UI).

### Budgets

- `budgets` / `budget_periods` (`unique(budget_id, period_start)`).

### Manually tracked assets/liabilities

- `assets` / `liabilities` — lighter-weight than `accounts`: no sync
  machinery, no `account_balances`-style history granularity, meant for
  one-off net-worth line items.
- `manual_valuations` — a shared history-of-value table pointing at exactly
  one of `account_id` / `asset_id` / `liability_id` (enforced by a
  `num_nonnulls(...) = 1` check constraint) rather than three separate
  near-identical history tables.

### Forecasting, alerts, AI, sync, exports

- `forecasts` / `forecast_scenarios` — a named forecast run and its
  baseline/conservative/expected/optimistic/custom variants.
- `alerts` / `alert_preferences`.
- `ai_conversations` / `ai_messages` / `ai_data_access_logs` — the latter
  records exactly which data classes and whether raw transactions were
  supplied to the model for a given message, independent of the message
  content itself (see `AI_PRIVACY.md`).
- `synchronization_jobs` / `synchronization_errors` — sync observability;
  designed to be written by Workflow DevKit steps in Phase 3 (see
  `ARCHITECTURE.md` §7).
- `exports` / `file_attachments`.

## Row Level Security

Applied via two `DO` blocks at the end of `0003_core_finance_schema.sql`: one
enables RLS on every table in this migration, the second applies the
standard four-policy set (`select`/`insert`/`update`/`delete`, all scoped to
`auth.uid() = user_id`) to every table *except*
`encrypted_provider_tokens`. Using a loop over a hardcoded table-name array
rather than hand-writing ~140 nearly-identical `CREATE POLICY` statements —
each policy is still a real, individually-inspectable row in `pg_policies`
once applied; the loop only avoids copy-paste risk during authoring.

## Verifying the schema

No live Supabase project has been exercised against this schema yet (see
`ARCHITECTURE.md` §10). Before relying on it:

```bash
supabase link --project-ref <ref>
supabase db push
```

Then run the RLS security tests described in `TESTING.md` against that
project (unauthenticated access denied, cross-user access denied, the
single-owner trigger rejects a second signup).
