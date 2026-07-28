# Threat Model

## Assets (what we're protecting)

Ranked roughly by sensitivity:

1. **Plaid access tokens** — if leaked, an attacker can read (though not move)
   real financial data at the connected institutions for as long as the
   token is valid.
2. **Session tokens / cookies** — hijacking one grants full access to the
   owner's financial view.
3. **The owner's credentials** (password, TOTP secret).
4. **Transaction/account/balance data** — a full picture of the owner's
   finances.
5. **AI conversation history and the data supplied to the AI provider.**
6. **Security/audit logs** — tampering could hide evidence of compromise.
7. **Backups** — contain everything above.

## Non-goals

- This is not a multi-tenant system; there is no "user A shouldn't see user
  B's data" scenario in practice. RLS is still enforced per-table as
  defense-in-depth against future mistakes (a bug that creates a second
  account, a bug in a query), not because multi-tenancy is expected.
- The app never moves money. Compromise of the app cannot directly cause a
  financial loss via a transfer, payment, or trade — only information
  disclosure (and, if Plaid credentials were somehow compromised at the
  provider level, whatever Plaid's own scopes allow, which excludes transfers
  since this app never requests Plaid's money-movement products).

## Trust boundaries

See `ARCHITECTURE.md` §3 for the diagram. In short: Browser (untrusted) →
Next.js server (trusted, but re-checks auth on every request) → Postgres
(RLS as backstop) → Plaid (external, tokens never leave the server) → AI
provider (external, receives only minimized data).

## Threat scenarios considered

### T1 — Stolen session cookie (XSS, malware, shared device)
- **Mitigation**: httpOnly, Secure, SameSite cookies (Supabase SSR default);
  strict CSP (`next.config.ts`) blocking third-party script execution;
  `requireUser()` calls `getUser()` (validates against the auth server, not
  just a local JWT check) so a session revoked server-side is rejected
  immediately rather than remaining valid until token expiry.
- **Residual risk**: a stolen cookie is valid until it's revoked or expires.
  Mitigated by the "sign out everywhere" control on the Security page and by
  keeping session lifetimes reasonable (see Supabase project auth settings).

### T2 — Credential stuffing / brute force against the one account
- **Mitigation**: `checkLoginRateLimit` (`src/lib/auth/rate-limit.ts`) applies
  escalating delays after 4 failed attempts within a 15-minute window, backed
  by the `login_events` audit trail (no separate infrastructure to keep in
  sync). TOTP MFA means a correct password alone is insufficient.
- **Residual risk**: rate limiting is per-email and DB-backed, not
  distributed/IP-based; a sufficiently patient attacker sees an escalating
  but not infinite delay. Acceptable for a single, low-QPS account; revisit if
  this pattern is reused for something with a wider blast radius.

### T3 — Compromised Plaid access token (server breach, log leak, backup leak)
- **Mitigation**: tokens are AES-256-GCM encrypted before storage
  (`encrypted_provider_tokens`), decryptable only by server code holding
  `PROVIDER_TOKEN_ENCRYPTION_KEY`; RLS on that table has zero policies for
  `authenticated`, so even a compromised owner session cannot read it via the
  normal client; the logging redaction pass (`src/lib/audit/redact.ts`) strips
  any field whose key name looks token/secret-shaped before it reaches
  `audit_events`.
- **Residual risk**: a full server + encryption-key compromise together would
  expose tokens. Mitigated by key rotation support (documented in
  `SECURITY.md`) and by never enabling Plaid's Transfer product, which bounds
  the damage to read access.

### T4 — A compromised or overly-eager AI integration (Phase 5)
- **Mitigation-by-design**: the AI layer is specified (see `AI_PRIVACY.md`) to
  receive only aggregated/structured summaries built by a data-preparation
  layer, never raw Plaid tokens, unrestricted transaction dumps, or
  credentials; every AI answer must be traceable to the calculation/data it
  used. Not yet implemented — flagged here so Phase 5 doesn't skip it.

### T5 — SQL injection / IDOR against the database
- **Mitigation**: all queries go through the Supabase client (parameterized),
  never raw string-concatenated SQL; RLS enforces row ownership independent
  of application-layer bugs; every table's policy checks `auth.uid() =
  user_id`, so even a route handler that forgot to filter by user still can't
  return another row (there is no other row, but the pattern generalizes if
  this codebase is ever adapted for multiple users).

### T6 — Malicious or accidental secret commit
- **Mitigation**: `.gitignore` excludes all `.env*` except `.env.example`;
  `scripts/secret-scan.mjs` runs pre-commit (Husky) and in CI; gitleaks runs
  in CI (`.github/workflows/ci.yml`) as a second, more thorough scanner; CI
  also greps the built client bundle for server-only secret variable names.

### T7 — Clickjacking / framing
- **Mitigation**: `frame-ancestors 'none'` in CSP plus `X-Frame-Options: DENY`
  as a fallback for older clients.

### T8 — Physical/backup compromise
- See `BACKUP_AND_RECOVERY.md` — backups inherit Supabase's at-rest
  encryption; anything exported by the app's own export feature (Phase 2+)
  will require recent re-authentication and expire automatically.

## Assumptions and open risks

- No live Supabase project has been exercised yet (see `ARCHITECTURE.md` §10)
  — RLS policies read correctly but haven't been tested against a running
  Postgres instance.
- No passkey/WebAuthn support (documented limitation, `SECURITY.md`).
- No independent penetration test has been performed. One is recommended
  before ever connecting production (non-sandbox) Plaid credentials.
