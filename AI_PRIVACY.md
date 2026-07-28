# AI Privacy & Safety (design — implementation starts Phase 5)

No AI code exists yet (`/ai-advisor` is a `ComingSoon` stub). This document
specifies the design so Phase 5 is built to this from day one rather than
retrofitted for privacy after the fact.

## Role of the AI

An analytical layer over deterministic calculations (`FINANCIAL_CALCULATIONS.md`),
not a financial institution and not an autonomous agent. It explains and
queries results; it does not compute unsupported numbers, execute
transactions, or silently change budgets/categories.

## Data minimization

The AI never receives:

- Plaid access tokens or any provider credential.
- Supabase auth/session tokens.
- Bank credentials of any kind (the app never has these to begin with).
- Full account numbers (the app only ever stores masked `mask` — last 4).
- Unnecessary personal identifiers.
- The entire database or an unrestricted transaction history.

Instead, a **data-preparation layer** (`src/lib/ai/context.ts`, Phase 5)
converts the relevant slice of financial data into a bounded schema before it
reaches the model:

```
{
  dateRange: { from, to },
  aggregatedIncome: number,        // cents
  aggregatedSpending: number,      // cents
  spendingByCategory: { category, amountCents }[],
  recurringCharges: { merchantLabel, amountCents, frequency }[],
  debts: { type, balanceCents, interestRate, minimumPaymentCents }[],
  savingsBalances: { accountType, balanceCents }[],
  goals: { name, targetCents, currentCents, targetDate }[],
  calculatedAvailableCash: number, // cents, from calculateSafeToSpend
  merchantLabels: "anonymized where the underlying calculation doesn't need the real name",
}
```

Calculated summaries are preferred over raw transaction rows wherever a
summary answers the question; raw transactions are only included when a
question genuinely requires transaction-level detail (e.g., "which
transactions made up this category last month"), and that inclusion is
recorded (see Audit below) and disclosed to the user before the request is
sent.

## User control

Before a request that would include a given data class goes to an external
model, the UI shows which classes are included and lets the user disable
categories for that conversation (Phase 5 UI requirement — not yet built).
`user_preferences.ai_analysis_enabled` is already in the schema
(Phase 1) as the master off switch.

## Response requirements

Every AI answer must include, not just prose:

- A direct answer.
- The supporting numbers and the calculation function that produced them.
- The time period and accounts included.
- Assumptions made.
- Data freshness (last sync time of the accounts involved).
- Confidence/uncertainty, explicitly — forecasts are labeled as estimates,
  never presented as guarantees.
- Suggested next actions.
- A link back to the underlying transactions/calculation.

The AI calls **approved internal tools** (net worth, cash flow, spending
comparison, merchant analysis, recurring-charge analysis, safe-to-spend,
debt scenario comparison, goal projection, bill lookup, transaction search,
anomaly detection, forecast generation — each wrapping a
`FINANCIAL_CALCULATIONS.md` function) rather than doing arithmetic from
memory. It must never save a suggested budget/category change without
explicit user approval.

## Audit trail

`ai_data_access_logs` (schema exists from Phase 1) records, per message:
question asked (via the linked `ai_messages` row), which data classes were
supplied, the model used, timestamp, and whether raw transactions were
included. Phase 5 adds an AI Audit screen surfacing this table directly so
the user can see exactly what was sent for any past answer.

## Provider configuration

Whichever model provider is used in Phase 5, the exact provider-side
configuration required to disable training on this app's requests (zero
data retention / no-training mode) must be documented here once chosen and
verified — do not assume a default; providers vary and change this over
time. Not yet applicable since no provider is wired up.

## What this rules out

- No AI code path may execute a transaction, transfer, or payment (the app
  has no such capability at all — see `ARCHITECTURE.md`).
- No AI code path may write to `budgets`, `transaction_categories`, or any
  other table without a corresponding explicit user-approval step recorded.
- `ai_conversations`/`ai_messages` are deletable by the user
  (Phase 2+ "delete AI conversation history" setting) independent of deleting
  other financial data.
