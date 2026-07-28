# Backup & Recovery

## Database

Supabase manages automated backups at the platform level (frequency and
retention depend on the project's plan — verify and record the actual
schedule here once a real project is provisioned; do not assume a specific
retention window without checking the project's settings). Backups inherit
Supabase's at-rest encryption; they are not a separate, less-protected copy
of the data.

Point-in-time recovery, if enabled on the plan in use, should be preferred
over a full backup restore for anything short of catastrophic data loss,
since it minimizes how much legitimate post-incident activity gets rolled
back along with the bad data.

## Application-level exports (Phase 2+)

The `exports` table and the "export your data" Settings control (currently a
disabled placeholder) are a *user-initiated download*, not a backup
mechanism — exports expire automatically, require recent authentication to
request, and are logged in `audit_events`. They exist for the owner's own
portability/records, not as a substitute for the database backup above.

## What is NOT backed up separately

- `PROVIDER_TOKEN_ENCRYPTION_KEY` and other secrets live only in Vercel's
  encrypted environment variable store. If this key is lost without a backup
  of it, every encrypted Plaid token becomes permanently undecryptable —
  reconnecting institutions (which issues fresh tokens) is the recovery path,
  not attempting to recover the key. Store the key in a password manager or
  secret-management tool the owner controls, outside of Vercel, as the actual
  backup for this specific value.

## Recovery drill (to perform once a real Supabase project exists)

1. Provision a throwaway Supabase project.
2. Restore a backup/snapshot into it.
3. Apply any migrations newer than the snapshot.
4. Point a local `.env.local` at the restored project and confirm the app
   boots, the owner can sign in, and RLS still behaves correctly.
5. Tear down the throwaway project.

This hasn't been performed yet (no live project exists) — treat it as a
Phase 3+ prerequisite before real financial data is ever stored, and record
the result here once done.
