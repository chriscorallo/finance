# Security

This document describes the security model as implemented through Phase 1.
See `THREAT_MODEL.md` for the adversarial analysis this model is meant to
satisfy, and `ARCHITECTURE.md` for the system diagram it refers to.

## Reporting

This is a private, single-owner application with no public users. There is no
external vulnerability-disclosure program; if you are the owner and find an
issue, track it as a normal repository issue and fix it directly.

## Sensitive data inventory

| Data | Where it lives | Who can read it |
|---|---|---|
| Plaid access tokens | `encrypted_provider_tokens.encrypted_access_token`, AES-256-GCM encrypted | Server code holding `PROVIDER_TOKEN_ENCRYPTION_KEY`; RLS blocks all `authenticated`-role access |
| Session/refresh tokens | httpOnly Supabase cookies | Browser (via cookie only, not JS-readable), Supabase Auth server |
| Password | Supabase Auth (`auth.users`), hashed by GoTrue | Never readable by this app |
| TOTP secret | Supabase Auth (`auth.mfa_factors`), managed entirely by Supabase's MFA API | Never readable by this app |
| Transactions/accounts/balances | `public.*` tables, RLS-scoped to the owner | The owner, via their own authenticated session only |
| Audit/login events | `audit_events`, `login_events` | The owner (read-only, via RLS `select` policy); only the service-role server process can insert |
| Encryption key | `PROVIDER_TOKEN_ENCRYPTION_KEY` env var | Server process only; never in a client bundle, never in Git |

## Trust boundaries

See `ARCHITECTURE.md` §3.

## Authentication model

- Provider: Supabase Auth.
- Sign-in method: email + password. No public sign-up route exists in the
  app (`src/app/login` has no sign-up form/action).
- Single-owner enforcement (defense in depth, two layers):
  1. Public sign-up disabled in the Supabase project's Auth settings.
  2. `enforce_single_owner_trigger` (Postgres trigger on `auth.users`,
     `supabase/migrations/0002_security_and_audit.sql`) rejects any insert
     once one user already exists.
  3. The owner account is created via `scripts/provision-owner.ts`, which
     itself refuses to run if `auth.admin.listUsers()` returns any existing
     user.
- MFA: TOTP, mandatory. `getMfaStatus()`/`requireFullyAuthenticated()`
  (`src/lib/auth/session.ts`) force enrollment at `/login/mfa-setup` before
  any other route is reachable, and force a challenge at `/login/mfa` on
  every session that hasn't reached AAL2.
- Session verification uses `supabase.auth.getUser()` (validates against the
  auth server) rather than `getClaims()` (local-JWT-only), so a
  server-revoked session is rejected immediately rather than remaining valid
  until the access token naturally expires.
- Rate limiting: `src/lib/auth/rate-limit.ts` — escalating delay after 4
  failed attempts within a 15-minute window, backed by `login_events` (no
  separate store to keep in sync or that could drift/leak independently).
- Session management: the Security page (`/settings/security`) lists active
  sessions via the `list_active_sessions()` Postgres function (reads
  `auth.sessions`, safe columns only) and offers "sign out other sessions"
  (`scope: 'others'`) and "sign out everywhere" (`scope: 'global'`).

### Known limitation: passkeys/WebAuthn

Supabase Auth's native passkey/WebAuthn support isn't solid enough today to
build on for the sole authentication factor. TOTP MFA is the interim control,
chosen deliberately over building custom WebAuthn (more engineering and
security-review surface for a single-user app) or switching to a dedicated
auth provider. Revisit if/when Supabase ships first-class passkey support.

### Known limitation: step-up recency

`requireAal2()` — used to gate disconnecting an institution, exporting data,
deleting data, and changing security settings — currently checks *that* the
session has reached AAL2, not *how recently*. A session that completed MFA
an hour ago passes the same check as one that just did. Supabase's
`getAuthenticatorAssuranceLevel()` API doesn't expose a challenge timestamp,
so a true recency-based step-up would require additional bookkeeping (e.g. a
signed, short-lived "recently verified" marker). Not implemented in Phase 1;
tracked as a Phase 4+ candidate.

### Known limitation: per-session revocation

There is no confirmed public Supabase API to revoke one specific *other*
session by ID — only "this device," "all others," or "everywhere." The
Security page's options are scoped to what's actually supported rather than
implying a capability that doesn't exist.

## Authorization model

- Every table in `public` has Row Level Security enabled
  (`supabase/migrations/0003_core_finance_schema.sql`) with deny-by-default
  policies: `select`/`insert`/`update`/`delete`, each scoped to
  `auth.uid() = user_id`.
- `encrypted_provider_tokens` is the one exception: RLS is enabled with
  **zero** policies for the `authenticated` role, so it is unreadable and
  unwritable from any normal client session — only the service-role client
  (`src/lib/supabase/admin.ts`) can touch it, and every call site using that
  client is expected to be hand-reviewed since RLS provides no backstop there.
- Every server action/route handler independently calls `requireUser()`,
  `requireFullyAuthenticated()`, or `requireAal2()` — the UI never being able
  to show a control is not treated as an authorization boundary.
- The service-role key (`SUPABASE_SECRET_KEY`) never appears in any file
  under `src/app/**/page.tsx` client-rendered path or any `"use client"`
  module; it's imported only via `src/lib/supabase/admin.ts`, which imports
  `server-only`.

## Encryption model

- **In transit**: TLS everywhere (Vercel + Supabase both terminate TLS by
  default; no plaintext HTTP path is configured).
- **At rest**: Supabase Postgres encryption at rest (platform-provided);
  application-layer AES-256-GCM on top for Plaid tokens specifically
  (`src/lib/crypto/token-cipher.ts`), using Node's built-in `node:crypto` —
  no custom cryptographic primitives.
- **Key storage**: `PROVIDER_TOKEN_ENCRYPTION_KEY` is a base64-encoded 32-byte
  key, stored only as an encrypted Vercel environment variable, never
  committed, never in `.env.example` with a real value.

### Key rotation procedure

1. Generate a new 32-byte key: `openssl rand -base64 32`.
2. Deploy code that can decrypt with *both* the old and new key (keyed by
   `encryption_key_version` on `encrypted_provider_tokens`) — not yet
   implemented since there are no tokens to rotate before Phase 3; implement
   this alongside the Phase 3 Plaid integration, before any real token is
   ever encrypted with a single, un-rotatable key.
3. Re-encrypt existing rows with the new key in a background job, bumping
   `encryption_key_version`.
4. Remove the old key from the environment once no rows reference it.

## Browser security headers

Set per-request in `src/proxy.ts` (CSP, since it needs a fresh nonce every
request) and statically in `next.config.ts` (everything else):

- **CSP**: `default-src 'self'`; `script-src` uses a per-request nonce +
  `'strict-dynamic'` (no `unsafe-inline`) — Next.js automatically applies the
  nonce to its own inline hydration/RSC scripts and to `next-themes`' anti-FOUC
  script once it sees the nonce in the response header. `style-src` keeps
  `'unsafe-inline'`: Base UI (shadcn/ui's primitives) sets inline `style`
  *attributes* for popover/overlay positioning, and CSP nonces only cover
  `<style>`/`<script>` *elements*, not style attributes — there is no
  nonce-based alternative for that today. `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- Reading the nonce (`headers().get("x-nonce")` in `app/layout.tsx`) opts the
  entire app into dynamic rendering — an accepted trade-off here since nearly
  every route is already dynamic (auth-gated) except `/login`, which is cheap
  to render dynamically too.
- `Strict-Transport-Security` and CSP's `upgrade-insecure-requests` are
  **production-only**. Sending either over local plain-HTTP dev makes the
  browser force-upgrade every subsequent request on the page to `https://`
  and fail outright — this actually happened during development and is why
  both are explicitly gated on `NODE_ENV !== "development"`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive
  `Permissions-Policy` are unconditional (no dev/prod split needed).

## Logging policy

- Security-relevant events (login success/failure, MFA enrollment/challenge
  failure, session revocation, security-setting changes) are written through
  `writeAuditEvent`/`writeLoginEvent` (`src/lib/audit/log.ts`) — never ad hoc
  `console.log` of request bodies.
- `src/lib/audit/redact.ts` recursively redacts any object key matching a
  secret-shaped pattern (`token`, `secret`, `password`, `api_key`,
  `authorization`, `cookie`, `jwt`, `otp`/`totp`/`mfa_code`, etc.) before it
  reaches `audit_events.event_data`. Unit-tested in `redact.test.ts`.
- MFA enrollment explicitly avoids logging `qr_code`, `secret`, or `uri`
  (per the Supabase SDK's own guidance) — see
  `src/app/login/mfa-setup/mfa-setup-form.tsx`.
- CI greps the built client bundle for server-only secret variable names as
  a backstop (`.github/workflows/ci.yml`).

## Account-disconnection procedure (Phase 3+)

Not yet implemented (no institutions can be connected yet). Design: mark
`connected_institutions.status = 'disconnected'`, set `disconnected_at`,
revoke the Plaid access token via Plaid's `/item/remove` endpoint, then
delete the corresponding row from `encrypted_provider_tokens`. Logged as
`institution_disconnected` in `audit_events`.

## Data-deletion procedure (Phase 2+)

Not yet implemented (Settings page has a disabled "Delete all data" control
as a placeholder). Design: cascade-delete all `user_id`-owned rows across
every table, disconnect every institution first (per above), delete AI
conversation history, and log `data_deletion_requested` before the delete
executes (since the row logging it may itself be subject to deletion policy —
the audit event is written first so the fact that deletion was requested
survives even if something fails partway through).

## Backup policy

See `BACKUP_AND_RECOVERY.md`.

## Incident response

See `INCIDENT_RESPONSE.md`.

## Dependency / repository security

- Dependabot configured for both `npm` and `github-actions` ecosystems
  (`.github/dependabot.yml`), weekly, grouped minor/patch updates.
- `gitleaks` runs in CI on every PR and push to `main`
  (`.github/workflows/ci.yml`).
- Husky pre-commit hook runs `scripts/secret-scan.mjs` and `tsc --noEmit`
  (`.husky/pre-commit`).
- `.env*` is gitignored except `.env.example`, which contains variable names
  only, never real or example-real-looking values.
- No production Supabase project or real financial data should ever be used
  in local development or CI — CI uses obviously-fake placeholder values
  (`.github/workflows/ci.yml`).

## Residual risks / not yet done

- No live Supabase project has been provisioned or tested against (see
  `ARCHITECTURE.md` §10).
- No independent penetration test has been performed — recommended before
  connecting production (non-sandbox) Plaid credentials, per the Phase 6 plan.
- Branch protection on `main` (no direct pushes, required CI) needs to be
  configured once this repository has a GitHub remote — it cannot be
  configured from inside the repository itself.
