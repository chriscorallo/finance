# Financial Calculations (design — implementation starts Phase 2)

No calculation code exists yet; this document specifies the design so Phase 2
implements it consistently rather than inventing conventions ad hoc per
feature. When implemented, this becomes the actual API reference — keep it in
sync with `src/lib/finance/` at that point.

## Core rule

**One centralized library, `src/lib/finance/`, pure functions, no I/O.**
UI components and server actions call these functions; they never
reimplement a formula inline. Every function takes plain data (already
fetched from Supabase) and returns plain data — no Supabase client, no
`fetch`, so they're trivially unit-testable with synthetic fixtures.

## Money handling

- All amounts in and out are integer cents (`bigint`/`number` cents,
  matching the `_cents` database columns) — never floating point.
- Percentages/rates use exact decimal representations (matches
  `numeric(6,4)` in the schema), not floats, to avoid compounding rounding
  error over multi-year forecasts.
- Currency conversion is out of scope for now (single-currency, `USD`
  default per the schema) — flag this explicitly if a foreign-currency
  account is ever added rather than silently mis-summing.

## Functions to implement (Phase 2 unless noted)

| Function | Inputs | Notes |
|---|---|---|
| `calculateNetWorth` | accounts + assets + liabilities, `as_of` | Respects `include_in_net_worth` |
| `calculateLiquidNetWorth` | same | Respects `include_in_liquid_net_worth` |
| `calculateMonthlyIncome` / `calculateMonthlyExpenses` | transactions, period | Excludes transfers/reimbursements by default (see below) |
| `calculateCashFlow` | transactions, period | Income − fixed − variable − debt payments − savings/investment transfers |
| `calculateSavingsRate` | income, savings contributions | |
| `calculateDebtToIncome` | debts, income | Estimate, labeled as such in the UI |
| `calculateCreditUtilization` | credit-type accounts | balance / credit_limit |
| `calculateSafeToSpend` (Phase 4) | cash, pending, upcoming bills, min payments, planned savings, cushion | Three modes: conservative/expected/flexible (`user_preferences.safe_to_spend_mode`) |
| `calculateRecurringAnnualCost` | recurring_items | Normalizes weekly/biweekly/monthly/quarterly/annual to an annual figure |
| `estimateInterest` | debt balance, rate, term | Simple/amortized as appropriate to `debt_type` |
| `calculateAvalanchePayoff` / `calculateSnowballPayoff` (Phase 4) | debts, extra payment, reserve | Never recommends depleting the reserve below `minimum_reserve_cents` |
| `calculateGoalCompletion` | goal, contribution rate, expected return | Conservative/expected variants |
| `runForecast` (Phase 4) | starting balances, assumptions, horizon | Compounds monthly; baseline/conservative/expected/optimistic |
| `calculateBudgetVariance` | budget_periods | planned vs. actual vs. projected pace |
| `calculateSpendingPace` | transactions, days elapsed in period | For "on track / at risk" budget signals |
| `calculateMonthEndProjection` | current cash, remaining known inflows/outflows | |

## Handling ambiguous transaction semantics

Every function that touches raw transactions must account for, and this
document defines the default treatment for:

- **Transfers** (`is_transfer = true`): excluded from income/expense totals
  by default (they're movement between the owner's own accounts, not
  spending), but included in liquidity-timing views (calendar, safe-to-spend).
- **Credit-card payments**: a transfer from checking to a credit card is a
  transfer, not an expense — the *purchases* on the card are the expense,
  recorded when they post to the card account.
- **Refunds/reimbursements** (`is_refund`/`is_reimbursement`): net against
  the original category's spend for that period rather than counting as
  separate income, unless the user has explicitly excluded them
  (`excluded_from_cash_flow`).
- **Splits**: a split transaction's parent amount is never double-counted
  with its `transaction_splits` rows in the same aggregate — aggregates
  should read from splits when they exist, else the parent row.
- **Pending transactions**: included in safe-to-spend and calendar
  projections (they represent committed cash movement) but excluded from
  historical category-spend comparisons until posted, to avoid a pending
  transaction that later changes amount/category corrupting a "final" report.
- **Duplicates**: prevented at the sync layer (unique index on
  `(account_id, provider_transaction_id)`), not detected/deduplicated
  after the fact by calculation code.
- **Stale/missing data**: any calculation whose required input is missing or
  older than a defined freshness threshold must say so in its result
  (`dataFreshness`/`assumptions` fields), not silently substitute a default —
  matches the "Data Quality Center" requirement that precise recommendations
  aren't shown when required inputs are missing.

## Testing requirement

Every function above ships with unit tests covering: the happy path, an
empty-input edge case, a transfer/refund edge case where relevant, and (for
anything with a rate/percentage) a check that rounding doesn't silently drop
or invent cents over repeated compounding.
