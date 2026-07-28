# Architecture

## 1. Purpose and scope

A private, single-owner personal finance command center: net worth, cash
flow, budgets, debt payoff planning, forecasting, and an AI advisor, built
read-only against connected financial institutions. See the root prompt this
project was built from (summarized in `README.md`'s phase table) for the full
feature scope; this document covers the technical shape of the system as
built through Phase 1.

## 2. High-level architecture

```
┌─────────────┐      HTTPS       ┌───────────────────────────┐
│   Browser    │ ───────────────▶│  Next.js (Vercel, Fluid    │
│ (Client Comp,│                 │  Compute) — App Router     │
│  Server Comp  │◀────────────── │  Server Actions            │
│  hydration)   │   RSC payload   │  Route Handlers            │
└─────────────┘                 │  proxy.ts (session refresh) │
                                  └──────────┬───────┬─────────┘
                                             │       │
                          Supabase client    │       │  service-role client
                          (RLS-enforced)     │       │  (bypasses RLS —
                                             ▼       ▼   narrow call sites only)
                                  ┌───────────────────────────┐
                                  │   Supabase Postgres        │
                                  │   - auth.users/sessions     │
                                  │   - public.* (RLS on every  │
                                  │     owned table)            │
                                  └───────────────────────────┘
                                             │
                                             ▼ (Phase 3+)
                                  ┌───────────────────────────┐
                                  │   Plaid (sandbox/dev/prod)  │
                                  └───────────────────────────┘
```

Nothing about this shape changes across phases — Phase 2+ adds tables, pages,
and background jobs inside the same boundaries, not new trust boundaries.

## 3. Trust boundaries

1. **Browser ↔ Server.** The browser is untrusted. It holds only the
   Supabase publishable key and httpOnly session cookies — never the secret
   key, never a decrypted Plaid token, never the AES encryption key.
2. **Server ↔ Database.** Server code uses one of two Supabase clients:
   - `src/lib/supabase/server.ts` — cookie-bound, RLS-enforced, used for
     everything a request does on behalf of the signed-in owner.
   - `src/lib/supabase/admin.ts` — service-role, RLS-bypassing, used only for
     a small, explicit set of server-only operations (writing audit/login
     events, the owner-provisioning script, and — from Phase 3 — Plaid
     webhook/sync jobs). Every call site is expected to be hand-checked; RLS
     does not protect these calls.
3. **Server ↔ Plaid** (Phase 3+). Access tokens are encrypted
   (`src/lib/crypto/token-cipher.ts`) before being stored and decrypted only
   inside the narrow server code that calls Plaid. They are never returned to
   the browser, logged, or included in AI context.
4. **Server ↔ AI provider** (Phase 5). Receives only the minimized, structured
   schema described in `AI_PRIVACY.md` — never raw tokens, credentials, or an
   unrestricted transaction dump.

## 4. Frontend

- Next.js 16 App Router, TypeScript strict, Server Components by default;
  `"use client"` only where interactivity is required (forms, toggles, menus).
- Tailwind CSS v4 (CSS-first config via `@theme` in `src/app/globals.css`),
  shadcn/ui components built on **Base UI** (`@base-ui/react`) rather than
  Radix — composition uses the `render` prop, not `asChild` (see `CLAUDE.md`).
- Design tokens: shadcn's standard surface/border/ring tokens, plus
  finance-specific semantic tokens (`--positive`, `--negative`, `--warning`,
  `--serious`, `--critical`, `--series-1`..`--series-8`) added in
  `globals.css`, sourced from the validated categorical/status palette in the
  `dataviz` skill (`references/palette.md`) rather than invented ad hoc.
- `next-themes` for light/dark (class strategy, `system` default).
- Recharts for charts (Phase 2+), Framer Motion used sparingly.

## 5. Backend

- **Server Actions** for mutations initiated from a form/UI action (sign-in,
  MFA enroll/verify, privacy-mode toggle, session revocation).
- **Route Handlers** reserved for webhooks and non-form integrations (Plaid
  webhooks land here starting Phase 3).
- **proxy.ts** (Next.js 16's renamed `middleware.ts`) refreshes the Supabase
  session cookie on every request and redirects unauthenticated requests away
  from non-public paths. This is a UX/defense-in-depth layer only — it is not
  the authorization boundary. Every server action/route handler independently
  calls `requireUser()` / `requireFullyAuthenticated()` / `requireAal2()`
  (`src/lib/auth/session.ts`), and RLS is the last line of defense underneath
  all of it.

## 6. Authentication & authorization

Full detail in `SECURITY.md`. Summary:

- Supabase Auth, email + password sign-in only — **no public sign-up route**.
  The single owner account is created out-of-band via
  `pnpm run provision-owner` (`scripts/provision-owner.ts`), which itself
  refuses to run if any user already exists.
- A Postgres trigger (`enforce_single_owner_trigger`, in
  `supabase/migrations/0002_security_and_audit.sql`) rejects any further
  insert into `auth.users` as defense-in-depth alongside disabling public
  sign-up in the Supabase dashboard.
- TOTP MFA is **mandatory**, not optional: `requireFullyAuthenticated()`
  forces first-time visitors to `/login/mfa-setup` before any other route is
  reachable, and forces a challenge at `/login/mfa` on every subsequent
  session that hasn't completed AAL2 yet.
- `requireAal2()` gates sensitive actions (disconnect institution, export,
  delete data, security settings) — currently equivalent to
  `requireFullyAuthenticated()`; see SECURITY.md for the recency-based
  step-up gap this leaves open.
- RLS: every owned table has `user_id` + deny-by-default policies (see
  `DATA_MODEL.md`). `encrypted_provider_tokens` has RLS enabled with **zero**
  policies for `authenticated` — only the service-role client can touch it.

## 7. Sync architecture (Phase 3+ design, not yet implemented)

Plaid sync, recurring-charge detection, and webhook processing will run on
**Vercel Workflow DevKit** rather than ad-hoc retry loops/cron handlers. This
gives idempotent steps, automatic retries, crash recovery, and observability
that map directly onto the `synchronization_jobs`/`synchronization_errors`
schema (cursor, retry count, last-successful-sync, per-step status) —
designed now so the schema doesn't need to change when Phase 3 lands.

## 8. Navigation / page map

Sidebar sections (see `src/components/app-shell/nav-config.ts`): Overview,
Cash Flow, Transactions, Recurring, Calendar, Budgets, Accounts, Net Worth,
Debts, Goals, Forecast, AI Advisor, Reports, Alerts, Data Quality, Security,
Settings. All except Security/Settings currently render a `ComingSoon` empty
state (`src/components/coming-soon.tsx`) naming the phase that implements them.

## 9. Phase plan

| Phase | Deliverable |
|---|---|
| 0 | This document set |
| 1 | Auth (password + mandatory TOTP MFA), RLS on full schema, security headers, audit logging, privacy mode, design system, app shell, CI/testing foundation |
| 2 | Manual accounts/transactions/categorization, net worth, cash flow, budgets, debts, goals, calendar — built and validated against synthetic data before any real institution is connected |
| 3 | Plaid Link (sandbox first), token encryption at rest, transaction/liability/investment sync, webhooks, Workflow-based sync jobs, Data Quality page |
| 4 | Safe-to-spend engine, debt payoff strategies, goal projections, scenario/forecast lab, financial health score, anomaly detection/alerts |
| 5 | AI Advisor — built on top of the deterministic calculations from Phases 2–4, never replacing them (see `AI_PRIVACY.md`) |
| 6 | Production hardening: dependency/secret/static-analysis scans, full RLS/route/action review, backup/restore verification, OWASP ASVS pass, residual-risk report, recommendation to get an independent pentest before connecting production (non-sandbox) Plaid credentials |

## 10. Known architecture-level risks

- No passkey/WebAuthn support yet (TOTP only) — see `SECURITY.md`.
- `requireAal2()` checks AAL2, not *recency* of the AAL2 challenge — a session
  that authenticated with MFA an hour ago passes the same check as one that
  just did. A true step-up-with-recency mechanism is a Phase 4+ candidate.
- Session listing/revocation is built on Supabase's `auth.sessions` table and
  `signOut({ scope })`, which supports "sign out this device / others /
  everywhere" but not "revoke this *other* specific session by ID" — there is
  no confirmed public API for that today (see `SECURITY.md`).
- No live Supabase project has been provisioned or tested against yet — the
  schema and RLS policies have been reviewed carefully but not exercised
  against a real Postgres instance. Verify with `supabase db push` (or the
  SQL editor) plus the security test suite in `TESTING.md` before relying on
  them.
