-- Extensions and shared helper functions used by every later migration.

create extension if not exists pgcrypto with schema extensions;

-- Generic updated_at trigger, applied per-table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Row trigger: stamps updated_at = now() on every UPDATE. Attached per-table.';
