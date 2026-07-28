# Personal Finance Command Center

A private, single-owner personal finance web application: net worth, cash flow,
budgeting, debt payoff planning, forecasting, and an AI advisor — built
read-only against connected financial institutions, with security treated as
a first-class requirement rather than an afterthought.

This is not a multi-tenant SaaS product. There is exactly one user account
("the owner"), enforced at the database level.

## Current status

This repository has completed **Phase 0** (architecture/threat-model/schema
documentation) and **Phase 1** (secure foundation) of the six-phase build
described in `ARCHITECTURE.md`. No financial data model is wired up to the UI
yet — see the phase table below.

| Phase | Scope | Status |
|---|---|---|
| 0 | Architecture, threat model, schema, phase plan (this doc set) | Done |
| 1 | Auth, MFA, RLS, security headers, audit logging, privacy mode, design system, app shell | Done |
| 2 | Manual accounts/transactions, net worth, budgets, debts, goals (synthetic data) | Not started |
| 3 | Plaid sandbox integration | Not started |
| 4 | Safe-to-spend, debt strategies, forecasting, financial health score, anomaly detection | Not started |
| 5 | AI advisor | Not started |
| 6 | Production hardening / security review | Not started |

## Stack

- **Frontend**: Next.js 16 (App Router), TypeScript strict, Tailwind CSS v4, shadcn/ui (Base UI primitives), Recharts, Framer Motion, Zod.
- **Backend**: Next.js Server Actions & Route Handlers, Supabase (Postgres + Auth), Row Level Security on every table.
- **Hosting**: Vercel (Fluid Compute), Supabase via the Vercel Marketplace integration.
- **Testing**: Vitest (unit/integration), Playwright (E2E).

See `ARCHITECTURE.md` for the full design and rationale, `SECURITY.md` for the
security model, and `DATA_MODEL.md` for the schema.

## Getting started (local development)

1. Copy `.env.example` to `.env.local` and fill in a Supabase project's values
   (see `DEPLOYMENT.md` for provisioning steps — sandbox/dev only, never
   production data in a dev environment).
2. Apply the migrations in `supabase/migrations/` to that project.
3. Disable public sign-up in the Supabase Auth dashboard for that project.
4. Provision the single owner account: `pnpm run provision-owner` (see the
   script header comment for required env vars).
5. `pnpm install`
6. `pnpm run dev`
7. Sign in at `/login`, then complete the mandatory TOTP enrollment — the
   app will not let you past that screen until it's done.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit/integration tests |
| `pnpm test:e2e` | Playwright E2E tests (see `TESTING.md` for required env vars) |
| `pnpm run secret-scan` | Scans staged changes for secret-shaped strings (also runs pre-commit) |
| `pnpm run provision-owner` | One-time owner account creation |

## Documentation index

- `ARCHITECTURE.md` — system design, phase plan, component/page map
- `THREAT_MODEL.md` — trust boundaries, sensitive data, attack scenarios
- `SECURITY.md` — auth/authz/encryption/logging model, known limitations
- `DATA_MODEL.md` — full database schema
- `FINANCIAL_CALCULATIONS.md` — calculation design (implemented starting Phase 2)
- `AI_PRIVACY.md` — AI data-minimization design (implemented starting Phase 5)
- `PLAID_INTEGRATION.md` — Plaid design (implemented starting Phase 3)
- `DEPLOYMENT.md` — hosting, environments, provisioning
- `INCIDENT_RESPONSE.md` — what to do when something goes wrong
- `BACKUP_AND_RECOVERY.md` — backup policy
- `TESTING.md` — test strategy and how to run each suite
- `CHANGELOG.md` — notable changes by phase
