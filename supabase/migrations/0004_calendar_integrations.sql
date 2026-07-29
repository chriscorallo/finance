-- Calendar aggregation ("Schedule") — Google Calendar, Microsoft/Outlook, and
-- Apple/iCloud Calendar. A separate feature from the financial calendar
-- (`calendar_events`, already defined in 0003) — deliberately distinct table
-- names so nothing collides. Same pattern as connected_institutions /
-- encrypted_provider_tokens: OAuth (or, for Apple, an app-specific password)
-- tokens are encrypted at the application layer before storage, and the
-- token table gets RLS enabled with zero policies for `authenticated` —
-- only the service-role server process can ever read or write it.

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'apple')),
  provider_account_email text,
  display_name text,
  status text not null default 'active' check (status in ('active', 'error', 'disconnected')),
  last_successful_sync_at timestamptz,
  last_attempted_sync_at timestamptz,
  error_message text,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calendar_connections_user_id_idx on public.calendar_connections (user_id);

create table public.encrypted_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.calendar_connections (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'apple')),
  -- Google/Microsoft: OAuth access + refresh tokens. Apple: the app-specific
  -- password goes in encrypted_access_token; encrypted_refresh_token and
  -- access_token_expires_at stay null (CalDAV uses HTTP Basic Auth, no token
  -- expiry concept).
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  access_token_expires_at timestamptz,
  encryption_key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.synced_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.calendar_connections (id) on delete cascade,
  provider_event_id text not null,
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  source text not null default 'sync' check (source in ('sync', 'app_created')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_event_id)
);

create index synced_calendar_events_user_id_start_at_idx on public.synced_calendar_events (user_id, start_at);

-- updated_at triggers
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array['calendar_connections', 'encrypted_calendar_tokens', 'synced_calendar_events'])
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      tbl
    );
  end loop;
end;
$$;

-- RLS: enable on all three, owner-only policies on everything except
-- encrypted_calendar_tokens (zero authenticated policies, service-role only).
do $$
declare
  tbl text;
begin
  for tbl in
    select unnest(array['calendar_connections', 'encrypted_calendar_tokens', 'synced_calendar_events'])
  loop
    execute format('alter table public.%I enable row level security', tbl);
  end loop;

  for tbl in
    select unnest(array['calendar_connections', 'synced_calendar_events'])
  loop
    execute format(
      'create policy "%s_select_own" on public.%I for select to authenticated using (auth.uid() = user_id)',
      tbl, tbl
    );
    execute format(
      'create policy "%s_insert_own" on public.%I for insert to authenticated with check (auth.uid() = user_id)',
      tbl, tbl
    );
    execute format(
      'create policy "%s_update_own" on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      tbl, tbl
    );
    execute format(
      'create policy "%s_delete_own" on public.%I for delete to authenticated using (auth.uid() = user_id)',
      tbl, tbl
    );
  end loop;
end;
$$;
