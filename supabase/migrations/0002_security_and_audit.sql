-- Single-owner enforcement, security/audit tables, and the session-listing
-- helper. This app has exactly one user account ("the owner"); everything
-- here treats that as an invariant to defend, not just a UI convention.

-- ---------------------------------------------------------------------------
-- Single-owner enforcement (defense in depth alongside disabling public
-- sign-up in Supabase Auth settings). Rejects any INSERT into auth.users
-- once one row already exists. The first row ever inserted (the owner,
-- provisioned out-of-band via the Admin API or dashboard) is allowed through.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_single_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from auth.users) >= 1 then
    raise exception 'This is a single-owner application; additional accounts are not permitted.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_single_owner_trigger on auth.users;
create trigger enforce_single_owner_trigger
  before insert on auth.users
  for each row execute function public.enforce_single_owner();

-- ---------------------------------------------------------------------------
-- user_preferences — one row per user (one row, ever, given single-owner).
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  privacy_mode boolean not null default false,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  ai_analysis_enabled boolean not null default true,
  analytics_enabled boolean not null default false,
  transaction_retention_days integer check (transaction_retention_days > 0),
  safe_to_spend_mode text not null default 'expected'
    check (safe_to_spend_mode in ('conservative', 'expected', 'flexible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

alter table public.user_preferences enable row level security;

create policy "user_preferences_select_own" on public.user_preferences
  for select to authenticated using (auth.uid() = user_id);
create policy "user_preferences_insert_own" on public.user_preferences
  for insert to authenticated with check (auth.uid() = user_id);
create policy "user_preferences_update_own" on public.user_preferences
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_preferences_delete_own" on public.user_preferences
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- login_events — append-only audit trail of authentication attempts.
-- user_id is nullable because failed attempts against an unknown/mistyped
-- email have no user to attribute to.
-- ---------------------------------------------------------------------------
create table public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  success boolean not null,
  failure_reason text,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index login_events_user_id_created_at_idx on public.login_events (user_id, created_at desc);
create index login_events_email_created_at_idx on public.login_events (email, created_at desc);

alter table public.login_events enable row level security;

create policy "login_events_select_own" on public.login_events
  for select to authenticated using (auth.uid() = user_id);
-- No insert/update/delete policy for authenticated: only the server-side
-- admin client (service role, bypasses RLS) writes login events.

-- ---------------------------------------------------------------------------
-- audit_events — append-only security/audit trail for sensitive actions
-- (see SECURITY.md for the full list of event types that must log here).
-- ---------------------------------------------------------------------------
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_events_user_id_created_at_idx on public.audit_events (user_id, created_at desc);
create index audit_events_event_type_idx on public.audit_events (event_type);

alter table public.audit_events enable row level security;

create policy "audit_events_select_own" on public.audit_events
  for select to authenticated using (auth.uid() = user_id);
-- No insert/update/delete policy for authenticated: only the server-side
-- audit logging utility (service role) writes audit events, so a compromised
-- client session can read its own history but can never tamper with it.

-- ---------------------------------------------------------------------------
-- list_active_sessions() — exposes safe, non-sensitive columns from
-- auth.sessions (which `authenticated` has no direct grant on) so the
-- Security page can show "active sessions and devices" without duplicating
-- session state into an app-owned table that could drift out of sync.
-- ---------------------------------------------------------------------------
create or replace function public.list_active_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamptz,
  not_after timestamptz,
  aal text,
  user_agent text,
  ip text,
  is_current boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    s.id,
    s.created_at,
    s.updated_at,
    s.refreshed_at,
    s.not_after,
    s.aal,
    s.user_agent,
    s.ip::text,
    s.id = (auth.jwt() ->> 'session_id')::uuid as is_current
  from auth.sessions s
  where s.user_id = auth.uid()
  order by coalesce(s.refreshed_at, s.created_at) desc;
$$;

revoke all on function public.list_active_sessions() from public;
grant execute on function public.list_active_sessions() to authenticated;
