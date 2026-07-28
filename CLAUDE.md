@AGENTS.md

# Working rules for this repository

This is a private, single-owner personal finance app. Security and financial
correctness outrank development speed. Read `ARCHITECTURE.md` and
`SECURITY.md` before making structural changes.

1. **Read-only against financial institutions.** Never implement transfers,
   payments, or any money-movement capability. If a request implies one,
   stop and flag it rather than implementing it.
2. **Plaid access tokens never reach the browser, logs, or Git.** They exist
   encrypted (AES-256-GCM, `src/lib/crypto/token-cipher.ts`) in
   `encrypted_provider_tokens`, readable only by the service-role client.
3. **Every table has RLS.** New tables must follow the pattern in
   `supabase/migrations/0003_core_finance_schema.sql`: `user_id` column, deny-
   by-default policies scoped to `auth.uid() = user_id`. Never add a table
   without RLS enabled in the same migration.
4. **Never trust client-provided user IDs.** Every server action/route
   handler must call `requireUser()`/`requireFullyAuthenticated()`/
   `requireAal2()` from `src/lib/auth/session.ts` — RLS is the backstop, not
   the only check.
5. **Server-only code imports `server-only`** (see `src/lib/env.server.ts`,
   `src/lib/supabase/admin.ts`, `src/lib/crypto/token-cipher.ts`) so a stray
   import into a Client Component fails the build instead of shipping a secret.
6. **Route security-relevant events through `writeAuditEvent`/
   `writeLoginEvent`** (`src/lib/audit/log.ts`), not ad hoc `console.log` —
   they redact secret-shaped fields automatically via `src/lib/audit/redact.ts`.
7. **Money is integer cents**, never floating point. Column names end in
   `_cents`. This applies to any new financial calculation code too (Phase 2+).
8. **Next.js 16**: middleware is `proxy.ts` (`proxy()` export, `proxyConfig`),
   not `middleware.ts`. `cookies()`/`headers()`/`params` are async.
9. **shadcn/ui here is built on Base UI** (`@base-ui/react`), not Radix.
   Composition uses the `render` prop (`<Trigger render={<Button/>} />`), not
   `asChild`.
10. **Don't build ahead of the current phase.** Check the phase table in
    `README.md` before adding a feature — Phase 2+ features (transactions,
    budgets, debts, AI advisor, etc.) intentionally don't exist yet, and the
    stub pages under `src/app/(app)/*` say so.
11. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` before
    considering a change complete.
