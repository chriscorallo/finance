# Changelog

Notable changes, grouped by phase. Not every commit — the things worth
remembering later.

## Phase 1 — Secure foundation (2026-07-27)

### Added

- Next.js 16 App Router project (TypeScript strict, Tailwind v4, shadcn/ui
  on Base UI primitives).
- Full database schema (`supabase/migrations/0001`–`0003`): ~35 tables
  covering security/audit, institutions/tokens, accounts, transactions,
  categorization, recurring/bills/calendar, goals, debts, budgets, manual
  assets/liabilities, forecasting, alerts, AI, sync observability, exports.
  Row Level Security enabled on every table, deny-by-default policies on all
  but `encrypted_provider_tokens` (zero policies by design).
- Supabase Auth: email+password sign-in only (no public sign-up route),
  single-owner enforcement via a Postgres trigger + provisioning script,
  mandatory TOTP MFA (enrollment forced before first use, challenge forced
  every session).
- Session management: `list_active_sessions()` RPC, "sign out other
  sessions"/"sign out everywhere" on the Security page.
- Login rate limiting (escalating delay, backed by `login_events`).
- Audit logging (`audit_events`/`login_events`) with automatic secret
  redaction.
- AES-256-GCM token cipher for future Plaid access tokens
  (`src/lib/crypto/token-cipher.ts`), unit-tested.
- Security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options,
  Referrer-Policy, Permissions-Policy) via `next.config.ts`.
- Privacy Mode (preference-backed toggle, app-wide context).
- Design token system: shadcn base tokens plus finance-specific semantic
  tokens (positive/negative/warning/serious/critical, 8-slot categorical
  chart palette) sourced from the `dataviz` skill's validated reference
  palette.
- App shell: collapsible sidebar (17 nav sections), topbar (search/quick-add
  stubs, privacy toggle, theme toggle, user menu), empty states for every
  not-yet-built section.
- Testing foundation: Vitest + Testing Library + jsdom, Playwright, a
  `server-only`/`client-only` test stub, CI (typecheck/lint/test/build/
  secret-scan/bundle-secret-grep), Husky pre-commit (secret-scan + typecheck),
  Dependabot.
- Owner-provisioning script (`scripts/provision-owner.ts`).
- Phase 0 documentation set: this file, `README.md`, `ARCHITECTURE.md`,
  `THREAT_MODEL.md`, `SECURITY.md`, `DATA_MODEL.md`,
  `FINANCIAL_CALCULATIONS.md` (design), `AI_PRIVACY.md` (design),
  `PLAID_INTEGRATION.md` (design), `DEPLOYMENT.md`, `INCIDENT_RESPONSE.md`,
  `BACKUP_AND_RECOVERY.md`, `TESTING.md`, `.env.example`.

### Verified

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (8 unit tests), and `pnpm build`
  all pass against placeholder env values.
- Manual `next dev` smoke test: `/` redirects unauthenticated requests to
  `/login` (proxy.ts); `/login/mfa` and `/login/mfa-setup` independently
  redirect unauthenticated requests too (page-level `requireUser()`, not just
  the proxy layer); all configured security headers present on responses; no
  server-only secret name found in the built client bundle.
- Actually loaded the app in a real (Playwright-driven) browser and looked at
  it — screenshots in light and dark, plus a real form fill-and-submit — not
  just curl/status-code checks. This caught three real bugs the automated
  checks above didn't:
  1. **Sending `Strict-Transport-Security` and CSP's `upgrade-insecure-requests`
     unconditionally** made Chrome force-upgrade every request on the page to
     `https://` after the first response — fatal on local plain-HTTP dev
     (`ERR_SSL_PROTOCOL_ERROR` on every subsequent asset). Fixed: both are now
     production-only (`next.config.ts`, `proxy.ts`).
  2. **`proxy.ts`'s negative-lookahead `matcher` regex did not reliably
     exclude `/_next/static/...`** — CSS/JS asset requests were being
     redirected to `/login`, breaking all styling. Fixed by moving the
     exclusion into a plain string/extension check in the function body
     instead of relying on matcher regex semantics.
  3. **No CSP allowance for inline scripts** (no `unsafe-inline`, no nonce)
     was silently blocking Next.js's own inline hydration/RSC scripts and
     next-themes' anti-FOUC script — the page rendered but was **not
     interactive** (React never hydrated) and dark mode never applied. Fixed
     with the officially documented nonce + `strict-dynamic` pattern
     (`proxy.ts` generates a per-request nonce; `app/layout.tsx` reads it via
     `headers()` and passes it to `next-themes`), rather than weakening the
     policy to `unsafe-inline` for scripts. This does mean the whole app is
     now dynamically rendered (no static optimization) — an accepted
     trade-off for a private, low-traffic app where nearly every route was
     already dynamic (auth-gated) anyway.
  4. A shadcn `init` rewrite of `globals.css` had left `--font-sans:
     var(--font-sans)` self-referential (should point at
     `--font-geist-sans`), silently falling back to the browser's serif
     default instead of Geist. Fixed.

### Known limitations (see `SECURITY.md`/`ARCHITECTURE.md` for detail)

- No passkey/WebAuthn support yet — TOTP only.
- `requireAal2()` checks AAL2 completion, not its recency.
- No live Supabase project has been provisioned or tested against yet —
  schema and RLS have been carefully reviewed but not exercised against a
  running Postgres instance. Do this before Phase 2.
- Session revocation supports "this device / others / everywhere," not
  revoking one arbitrary other session by ID (no confirmed public API for
  that today).
