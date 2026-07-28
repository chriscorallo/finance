-- Core financial domain schema. All money columns are integer minor units
-- (cents) — never floating point. Every owned table has user_id, created_at,
-- updated_at, and gets RLS deny-by-default policies applied in the DO block
-- at the end of this file (except encrypted_provider_tokens, which gets zero
-- authenticated-role policies by design: only the service-role/server can
-- ever read or write it).

-- ---------------------------------------------------------------------------
-- Institutions & provider tokens
-- ---------------------------------------------------------------------------
create table public.connected_institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'plaid',
  provider_institution_id text,
  name text not null,
  logo_url text,
  status text not null default 'active' check (status in ('active', 'error', 'disconnected')),
  last_successful_sync_at timestamptz,
  last_attempted_sync_at timestamptz,
  error_code text,
  error_message text,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Access tokens are encrypted at the application layer (AES-256-GCM) before
-- being stored here; the decryption key never enters the database. RLS is
-- enabled with NO policies for `authenticated`, so only the service-role
-- server process can ever read or write this table.
create table public.encrypted_provider_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid not null references public.connected_institutions (id) on delete cascade,
  provider text not null default 'plaid',
  encrypted_access_token text not null,
  encryption_key_version integer not null default 1,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references public.connected_institutions (id) on delete set null,
  provider_account_id text,
  name text not null,
  official_name text,
  account_type text not null check (account_type in (
    'checking', 'savings', 'money_market', 'credit_card',
    'loan_personal', 'loan_student', 'loan_mortgage', 'loan_auto',
    'brokerage', 'retirement', 'crypto', 'real_estate', 'vehicle',
    'business_equity', 'other_asset', 'other_liability'
  )),
  account_subtype text,
  mask text,
  current_balance_cents bigint not null default 0,
  available_balance_cents bigint,
  currency text not null default 'USD',
  interest_rate numeric(6, 4),
  credit_limit_cents bigint,
  minimum_payment_cents bigint,
  payment_due_day smallint check (payment_due_day between 1 and 31),
  is_manual boolean not null default false,
  include_in_net_worth boolean not null default true,
  include_in_liquid_net_worth boolean not null default false,
  include_in_spending boolean not null default true,
  sync_status text not null default 'ok' check (sync_status in ('ok', 'error', 'stale', 'never_synced')),
  last_synced_at timestamptz,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);

create table public.account_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  balance_cents bigint not null,
  available_balance_cents bigint,
  as_of date not null,
  source text not null default 'sync' check (source in ('sync', 'user_entered', 'estimated')),
  created_at timestamptz not null default now()
);

create index account_balances_account_id_as_of_idx on public.account_balances (account_id, as_of desc);

-- ---------------------------------------------------------------------------
-- Transaction categorization
-- ---------------------------------------------------------------------------
create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  parent_category_id uuid references public.transaction_categories (id) on delete set null,
  icon text,
  color text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transaction_category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_type text not null check (match_type in ('merchant', 'description', 'account', 'amount_range')),
  match_value text,
  account_id uuid references public.accounts (id) on delete cascade,
  amount_min_cents bigint,
  amount_max_cents bigint,
  category_id uuid not null references public.transaction_categories (id) on delete cascade,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  provider_transaction_id text,
  transaction_date date not null,
  authorized_date date,
  posted_date date,
  merchant_name text,
  original_description text not null,
  clean_name text,
  amount_cents bigint not null,
  currency text not null default 'USD',
  category_id uuid references public.transaction_categories (id) on delete set null,
  category_rule_id uuid references public.transaction_category_rules (id) on delete set null,
  subcategory text,
  transaction_type text,
  pending boolean not null default false,
  is_transfer boolean not null default false,
  is_reimbursement boolean not null default false,
  is_refund boolean not null default false,
  tax_deductible boolean not null default false,
  business_or_personal text not null default 'personal' check (business_or_personal in ('business', 'personal')),
  essential_or_discretionary text check (essential_or_discretionary in ('essential', 'discretionary')),
  budget_class text check (budget_class in ('need', 'want', 'savings', 'debt')),
  excluded_from_spending boolean not null default false,
  excluded_from_cash_flow boolean not null default false,
  is_recurring boolean not null default false,
  category_confidence numeric(3, 2) check (category_confidence between 0 and 1),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index transactions_account_provider_id_uidx
  on public.transactions (account_id, provider_transaction_id)
  where provider_transaction_id is not null;
create index transactions_user_id_date_idx on public.transactions (user_id, transaction_date desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);

create table public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  category_id uuid references public.transaction_categories (id) on delete set null,
  amount_cents bigint not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transaction_splits_transaction_id_idx on public.transaction_splits (transaction_id);

create table public.transaction_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (transaction_id, tag)
);

-- ---------------------------------------------------------------------------
-- Recurring charges, bills, calendar
-- ---------------------------------------------------------------------------
create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.transaction_categories (id) on delete set null,
  name text not null,
  merchant_name text,
  direction text not null default 'expense' check (direction in ('income', 'expense')),
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'irregular')),
  typical_amount_cents bigint,
  amount_min_cents bigint,
  amount_max_cents bigint,
  next_expected_date date,
  last_charged_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'uncertain', 'canceled')),
  essential boolean not null default true,
  detection_confidence numeric(3, 2) check (detection_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recurring_item_id uuid not null references public.recurring_items (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete set null,
  expected_date date not null,
  expected_amount_cents bigint,
  matched boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  recurring_item_id uuid references public.recurring_items (id) on delete set null,
  name text not null,
  amount_cents bigint,
  due_date date not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'paid', 'overdue', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Goals (created before calendar_events / debts, which may reference it)
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  linked_account_id uuid references public.accounts (id) on delete set null,
  name text not null,
  goal_type text not null check (goal_type in (
    'emergency_fund', 'debt_payoff', 'home_down_payment', 'vehicle', 'travel',
    'taxes', 'business_investment', 'retirement', 'large_purchase', 'custom'
  )),
  target_amount_cents bigint not null,
  current_amount_cents bigint not null default 0,
  target_date date,
  priority integer not null default 0,
  monthly_contribution_cents bigint not null default 0,
  expected_annual_return numeric(5, 4) not null default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  amount_cents bigint not null,
  contribution_date date not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Debts & payoff scenarios
-- ---------------------------------------------------------------------------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  name text not null,
  debt_type text not null check (debt_type in (
    'credit_card', 'personal_loan', 'student_loan', 'auto_loan', 'mortgage', 'medical', 'other'
  )),
  current_balance_cents bigint not null default 0,
  interest_rate numeric(6, 4),
  promotional_rate numeric(6, 4),
  promotional_expires_on date,
  minimum_payment_cents bigint,
  payment_due_day smallint check (payment_due_day between 1 and 31),
  credit_limit_cents bigint,
  remaining_term_months integer,
  fees_cents bigint not null default 0,
  secured boolean not null default false,
  tax_deductible boolean not null default false,
  priority integer,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debt_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  effective_date date not null,
  interest_rate numeric(6, 4),
  minimum_payment_cents bigint,
  notes text,
  created_at timestamptz not null default now()
);

create table public.debt_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  strategy text not null check (strategy in (
    'avalanche', 'snowball', 'highest_utilization', 'minimum_only', 'custom_priority',
    'hybrid', 'promo_expiration', 'cash_flow_optimized', 'credit_score_oriented', 'user_defined'
  )),
  extra_monthly_cents bigint not null default 0,
  lump_sum_cents bigint not null default 0,
  minimum_reserve_cents bigint not null default 0,
  payoff_deadline date,
  assumptions jsonb not null default '{}'::jsonb,
  computed_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.debt_scenario_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_scenario_id uuid not null references public.debt_scenarios (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  payment_month date not null,
  payment_amount_cents bigint not null,
  principal_cents bigint,
  interest_cents bigint,
  remaining_balance_cents bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Calendar (after goals/recurring_items/bills, which it can reference)
-- ---------------------------------------------------------------------------
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  event_type text not null check (event_type in (
    'income', 'bill', 'subscription', 'goal_deadline', 'reminder', 'other'
  )),
  amount_cents bigint,
  event_date date not null,
  recurring_item_id uuid references public.recurring_items (id) on delete set null,
  bill_id uuid references public.bills (id) on delete set null,
  goal_id uuid references public.goals (id) on delete set null,
  is_manual_plan boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Budgets
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.transaction_categories (id) on delete set null,
  name text not null,
  budget_type text not null default 'category' check (budget_type in (
    'category', 'zero_based', 'rollover', 'weekly', 'sinking_fund'
  )),
  amount_cents bigint not null,
  rollover_behavior text not null default 'none' check (rollover_behavior in (
    'rollover', 'return_to_unallocated', 'to_savings', 'to_debt', 'ignore'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  budget_id uuid not null references public.budgets (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  planned_cents bigint not null,
  actual_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_id, period_start)
);

-- ---------------------------------------------------------------------------
-- Manually tracked assets/liabilities (lighter-weight than a full account —
-- no sync machinery, no balance-history granularity beyond manual_valuations)
-- ---------------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  asset_type text not null,
  value_cents bigint not null default 0,
  include_in_net_worth boolean not null default true,
  is_estimated boolean not null default true,
  as_of date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  liability_type text not null,
  balance_cents bigint not null default 0,
  include_in_net_worth boolean not null default true,
  is_estimated boolean not null default true,
  as_of date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manual_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete cascade,
  liability_id uuid references public.liabilities (id) on delete cascade,
  value_cents bigint not null,
  as_of date not null,
  source text not null default 'user_entered' check (source in ('user_entered', 'estimated')),
  created_at timestamptz not null default now(),
  constraint manual_valuations_single_target check (
    (num_nonnulls(account_id, asset_id, liability_id) = 1)
  )
);

-- ---------------------------------------------------------------------------
-- Forecasting
-- ---------------------------------------------------------------------------
create table public.forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  horizon text not null check (horizon in ('30d', '3m', '6m', '12m', '3y', '5y')),
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.forecast_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  forecast_id uuid not null references public.forecasts (id) on delete cascade,
  scenario_type text not null check (scenario_type in (
    'baseline', 'conservative', 'expected', 'optimistic', 'custom'
  )),
  name text,
  parameters jsonb not null default '{}'::jsonb,
  computed_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete cascade,
  alert_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  description text,
  amount_cents bigint,
  detection_method text,
  confidence numeric(3, 2) check (confidence between 0 and 1),
  status text not null default 'open' check (status in ('open', 'snoozed', 'dismissed', 'resolved')),
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  alert_type text not null,
  enabled boolean not null default true,
  threshold jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, alert_type)
);

-- ---------------------------------------------------------------------------
-- AI advisor
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  data_classes_included text[] not null default '{}',
  model text,
  raw_transactions_included boolean not null default false,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_data_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  message_id uuid references public.ai_messages (id) on delete set null,
  data_classes text[] not null default '{}',
  model text,
  raw_transactions_included boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Synchronization observability
-- ---------------------------------------------------------------------------
create table public.synchronization_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  institution_id uuid references public.connected_institutions (id) on delete cascade,
  job_type text not null check (job_type in ('initial_sync', 'incremental_sync', 'webhook', 'recurring_detection')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  cursor text,
  retry_count integer not null default 0,
  error_code text,
  error_message text,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  records_removed integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.synchronization_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  synchronization_job_id uuid not null references public.synchronization_jobs (id) on delete cascade,
  error_code text,
  error_message text,
  provider_error_redacted jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Exports & attachments
-- ---------------------------------------------------------------------------
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  export_type text not null,
  format text not null check (format in ('csv', 'json', 'pdf')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'expired', 'failed')),
  file_path text,
  expires_at timestamptz,
  requested_ip inet,
  created_at timestamptz not null default now()
);

create table public.file_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete cascade,
  storage_path text not null,
  file_name text,
  content_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers for every table that has the column
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'connected_institutions', 'encrypted_provider_tokens', 'accounts',
      'transaction_categories', 'transaction_category_rules', 'transactions',
      'transaction_splits', 'recurring_items', 'bills', 'goals', 'debts',
      'debt_scenarios', 'calendar_events', 'budgets', 'budget_periods',
      'assets', 'liabilities', 'forecasts', 'forecast_scenarios', 'alerts',
      'alert_preferences', 'ai_conversations', 'synchronization_jobs'
    ])
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      tbl
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: enable on every table in this migration, then apply
-- the standard "owner can do everything to their own rows, nobody else can
-- do anything" policy set to every table EXCEPT encrypted_provider_tokens,
-- which intentionally gets RLS enabled with zero policies for `authenticated`
-- (default-deny — only the service-role server process can touch it).
-- ---------------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array[
      'connected_institutions', 'encrypted_provider_tokens', 'accounts', 'account_balances',
      'transaction_categories', 'transaction_category_rules', 'transactions',
      'transaction_splits', 'transaction_tags', 'recurring_items', 'recurring_occurrences',
      'bills', 'goals', 'goal_contributions', 'debts', 'debt_terms', 'debt_scenarios',
      'debt_scenario_payments', 'calendar_events', 'budgets', 'budget_periods',
      'assets', 'liabilities', 'manual_valuations', 'forecasts', 'forecast_scenarios',
      'alerts', 'alert_preferences', 'ai_conversations', 'ai_messages', 'ai_data_access_logs',
      'synchronization_jobs', 'synchronization_errors', 'exports', 'file_attachments'
    ])
  loop
    execute format('alter table public.%I enable row level security', tbl);
  end loop;

  for tbl in
    select unnest(array[
      'connected_institutions', 'accounts', 'account_balances',
      'transaction_categories', 'transaction_category_rules', 'transactions',
      'transaction_splits', 'transaction_tags', 'recurring_items', 'recurring_occurrences',
      'bills', 'goals', 'goal_contributions', 'debts', 'debt_terms', 'debt_scenarios',
      'debt_scenario_payments', 'calendar_events', 'budgets', 'budget_periods',
      'assets', 'liabilities', 'manual_valuations', 'forecasts', 'forecast_scenarios',
      'alerts', 'alert_preferences', 'ai_conversations', 'ai_messages', 'ai_data_access_logs',
      'synchronization_jobs', 'synchronization_errors', 'exports', 'file_attachments'
    ])
  loop
    execute format(
      'create policy "%s_select_own" on public.%I for select to authenticated using (auth.uid() = user_id)',
      tbl, tbl
    );
    execute format(
      'create policy "%s_insert_own" on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      tbl, tbl
    );
    execute format(
      'create policy "%s_update_own" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      tbl, tbl
    );
    execute format(
      'create policy "%s_delete_own" on public.%I for delete to authenticated using (auth.uid() = user_id)',
      tbl, tbl
    );
  end loop;
end;
$$;
