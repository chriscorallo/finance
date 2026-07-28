# Deployment

## Hosting

- **Application**: Vercel. Fluid Compute (default) for all functions —
  Next.js 16's `proxy.ts` and Server Actions run as regular Node.js, no
  Edge-only runtime constraints to work around.
- **Database/Auth**: Supabase, provisioned through the Vercel Marketplace
  integration so environment variables sync automatically to Vercel rather
  than being copy-pasted between dashboards.
- **Regions**: pick the Supabase project region to match the primary Vercel
  deployment region to minimize latency; document the chosen region here once
  a real project exists.

## Environments

Three separate Supabase projects, matching three deployment targets:

| Environment | Supabase project | Plaid env | Notes |
|---|---|---|---|
| Development (local) | Dev/sandbox project | `sandbox` | Never real financial data |
| Preview (Vercel preview deployments) | Same dev project, or a dedicated preview project | `sandbox` | |
| Production | Production project | `production` (only after Phase 6) | Real data only after the Phase 6 hardening pass |

Never point a preview or development deployment at the production Supabase
project or production Plaid credentials.

## Provisioning a new Supabase project

1. Create the project (via the Vercel Marketplace Supabase integration, or
   directly in Supabase, then link with `vercel env pull` /
   `supabase link`).
2. Apply migrations: `supabase db push` (or paste each file under
   `supabase/migrations/` into the SQL editor in order — `0001`, `0002`,
   `0003`).
3. In the Supabase dashboard, Auth settings: **disable public sign-up** and
   enable TOTP MFA (should be on by default; verify).
4. Set environment variables (see `.env.example` for the full list) in the
   corresponding Vercel environment (Development/Preview/Production) —
   `vercel env add <NAME> <environment>`.
5. Provision the owner account:
   ```bash
   SUPABASE_URL=<project url> \
   SUPABASE_SECRET_KEY=<secret key> \
   OWNER_EMAIL=<owner email> \
   OWNER_PASSWORD=<strong password> \
     pnpm run provision-owner
   ```
6. Deploy, sign in at `/login`, and complete TOTP enrollment immediately —
   the app will not allow access to any other route until that's done.

## Environment variables

See `.env.example` for the authoritative list of names (no values). Secrets
(`SUPABASE_SECRET_KEY`, `PROVIDER_TOKEN_ENCRYPTION_KEY`, Plaid secrets) must
only ever be set as encrypted Vercel environment variables, never committed,
never placed in `vercel.json`/`next.config.ts` as literals.

## Build/deploy pipeline

- Vercel's native Git integration handles preview deployments per PR and
  production deployments on merge to `main` — no custom deploy step is
  needed in `.github/workflows/ci.yml`, which exists to gate PRs on
  typecheck/lint/test/build/secret-scan before Vercel's own deployment runs.
- Branch protection on `main` (required CI checks, no direct pushes) should
  be configured in GitHub repository settings once this repo has a remote —
  it can't be set from inside the repository.

## Rollbacks

Use Vercel's deployment history to roll back the application instantly if a
deploy introduces a regression. Database migrations are additive-by-default
in this schema (Phase 1 has no destructive migrations); a migration that
needs to be reversible should ship its own explicit `down` path documented in
the migration file's comments when Phase 2+ starts modifying existing tables.

## Never do this

- Never run migrations or the provisioning script against the production
  project from a laptop with the production secret key sitting in shell
  history — use `vercel env pull` into a short-lived local `.env` and clear
  it after.
- Never copy production data into a development or preview Supabase project.
- Never deploy Plaid `production` credentials before Phase 6's hardening
  checklist is complete and, ideally, an independent penetration test has
  been performed.
