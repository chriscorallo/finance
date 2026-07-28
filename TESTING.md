# Testing

## Philosophy

A feature isn't done because it renders. Calculations get unit tests,
security-sensitive code gets security tests, and end-to-end flows get
Playwright coverage — but tests scale with what's actually implemented; this
document reflects what exists today (Phase 1) and what Phase 2+ must add.

Never use real production financial data in any test, fixture, or CI run.

## Running the suites

| Command | Runs |
|---|---|
| `pnpm test` | Vitest unit/integration tests (`src/**/*.test.ts(x)`) |
| `pnpm run test -- --coverage` | Same, with coverage (v8 provider) |
| `pnpm test:e2e` | Playwright E2E (`e2e/**/*.spec.ts`) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm run secret-scan` | Staged-diff secret scan (also runs pre-commit) |

## Unit/integration tests (implemented)

- `src/lib/crypto/token-cipher.test.ts` — encrypt/decrypt round-trip,
  ciphertext non-determinism (random IV), tampered-ciphertext rejection,
  wrong-key-length rejection.
- `src/lib/audit/redact.test.ts` — secret-shaped keys redacted, nested
  objects/arrays handled, circular references don't crash, primitives pass
  through unchanged.

### Testing server-only code under Vitest

`server-only`/`client-only` unconditionally throw outside Next.js's
`react-server` bundler condition, which Vitest doesn't set up. They're
aliased to a no-op stub (`test/stubs/noop-module.ts`) in `vitest.config.ts`
so modules that import them can still be unit-tested directly — this is a
test-environment shim only; it must never affect the actual Next.js build
(verify by checking `next.config.ts`/`vitest.config.ts` stay separate, which
they are).

### Not yet covered (add as each lands)

- Categorization rules engine, recurring-charge detection, forecasting,
  debt-scenario math, budget variance (Phase 2/4) — see
  `FINANCIAL_CALCULATIONS.md` for the full function list and required edge
  cases (empty input, transfers/refunds, rounding over compounding).
- Input validation schemas (Zod) beyond the login/MFA forms.
- AI context construction / data-class minimization (Phase 5).

## Integration tests (Phase 3+, once Plaid/Supabase-live testing is set up)

- Plaid sandbox token exchange.
- Transaction sync idempotency (re-running a sync doesn't duplicate rows —
  exercised against the `(account_id, provider_transaction_id)` unique
  index).
- Webhook signature verification and replay handling.
- Account disconnection (token deleted, institution marked disconnected).
- Export creation and expiry.

## Security tests (partially covered; expand per the checklist below)

Requires a live Supabase test project (see `DEPLOYMENT.md`). Not yet run
against one — see `ARCHITECTURE.md` §10.

- [ ] Unauthenticated request to any `(app)` route redirects to `/login`
      (exercised manually against `pnpm dev` for `/`, `/login/mfa`,
      `/login/mfa-setup` — see build/verification notes in `CHANGELOG.md`;
      needs a Playwright/integration test once credentials exist).
- [ ] A second `auth.users` insert is rejected by
      `enforce_single_owner_trigger`.
- [ ] Cross-user row access is blocked by RLS (moot with one user today —
      still worth a test using two Supabase test users against RLS directly,
      since it's the mechanism this app would rely on if that assumption
      ever changed).
- [ ] `encrypted_provider_tokens` is unreadable via the `authenticated` role
      under any query shape.
- [ ] Login rate limiting actually delays the 5th+ failed attempt.
- [ ] Session revocation (`others`/`global`) actually invalidates the
      targeted sessions' `getUser()` calls, not just removes the local cookie.
- [ ] CI's client-bundle secret grep (`.github/workflows/ci.yml`) fails the
      build if a server-only secret name appears in `.next/static`.

## End-to-end tests (Playwright)

`e2e/auth-flow.spec.ts` covers owner login → MFA challenge → dashboard shell,
privacy-mode toggle, and session revocation via the Security page. These
tests are **skipped** until three env vars are set:

```
E2E_OWNER_EMAIL=<seeded test owner email>
E2E_OWNER_PASSWORD=<seeded test owner password>
E2E_OWNER_TOTP_SECRET=<the Base32 TOTP secret from that owner's enrollment>
```

To seed a project for this: run `pnpm run provision-owner` against a
**test** Supabase project, sign in once manually to complete TOTP enrollment,
and save the Base32 secret shown during enrollment (`mfa-setup-form.tsx`
displays it for manual entry) — that's the value E2E tests use to generate
valid codes via `otplib` (`e2e/support/totp.ts`), the same way a real
authenticator app would.

Never point `E2E_*` env vars at the production Supabase project.

## CI

`.github/workflows/ci.yml` runs on every PR and push to `main`:
gitleaks secret scan, typecheck, lint, unit tests with coverage, production
build, and a grep of the built client bundle for server-only secret names.
Playwright E2E is not yet wired into CI since it requires a seeded test
Supabase project — add a workflow job once one exists, using GitHub Actions
secrets for `E2E_*`, never committed values.
