# Incident Response

A private, single-owner application has a short incident-response chain —
the owner is both the operator and the only affected user — but the steps
still matter under pressure, so they're written down in advance rather than
improvised.

## Suspected credential compromise (password and/or TOTP)

1. From any still-trusted device, sign in and go to Security
   (`/settings/security`).
2. Click **Sign out everywhere** — invalidates every session immediately
   (`scope: 'global'`, `src/app/(app)/settings/security/actions.ts`).
3. Change the password immediately after (Supabase Auth password reset —
   Phase 2+ UI; until then, reset via the Supabase dashboard).
4. Click **Start over** under Two-factor authentication to unenroll the old
   TOTP factor and enroll a new one (`resetMfaFactorAction`).
5. Review `login_events` and `audit_events` on the Security page for any
   sign-in or session activity you don't recognize.

## Suspected session/cookie theft (device compromise, shared computer)

Same as above, steps 1–2 are usually sufficient since sessions, not just the
password, are the actual attack surface here.

## Suspected Plaid access-token leak (server/log/backup exposure)

Not applicable until Phase 3 (no tokens exist yet). When it is:

1. Disconnect every connected institution immediately (revokes the token at
   Plaid via `/item/remove` and deletes the local encrypted copy — see
   `SECURITY.md`/`PLAID_INTEGRATION.md`).
2. Rotate `PROVIDER_TOKEN_ENCRYPTION_KEY` (see `SECURITY.md` key-rotation
   procedure) even though the exposed token itself is now revoked, since a
   key exposure may extend to more than one token.
3. Reconnect institutions fresh, generating new tokens, once the cause of the
   leak is understood and fixed.
4. Check `synchronization_errors` and Vercel deployment logs for the window
   around the suspected leak.

## Suspected database compromise

1. Rotate the Supabase service-role (`SUPABASE_SECRET_KEY`) and publishable
   keys immediately from the Supabase dashboard.
2. Rotate `PROVIDER_TOKEN_ENCRYPTION_KEY` (Phase 3+).
3. Force a global sign-out (see above).
4. Review `audit_events` for the full history available, and Supabase's own
   project logs for query-level activity outside this app's expected patterns.
5. Restore from a known-good backup if data integrity (not just
   confidentiality) is in question — see `BACKUP_AND_RECOVERY.md`.

## Suspected secret committed to Git

1. Rotate the specific secret immediately (assume it's compromised the
   moment it's pushed, even to a private repo — Git history is
   effectively permanent).
2. Remove it from history (`git filter-repo` or equivalent) if the repo is
   or ever will be shared; note that rotation, not history-scrubbing, is the
   actual mitigation.
3. Check `gitleaks`/CI output for exactly what was exposed and for how long.

## After any incident

Write down what happened, what the trigger was, and what changed as a result
(a config fix, an added test, a process change) in `CHANGELOG.md` — even for
a single-user app, a written record is what makes the next incident faster
to handle.
