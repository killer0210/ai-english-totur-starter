-- M2: profiles (docs/backend_schema.md §2.1, §4; ADR-004, ADR-005).

-- Fail closed for everything created later by this role in public: client
-- roles get no table writes and no function execution unless a migration
-- grants them explicitly. Grants to service_role are left untouched.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

create type public.english_level as enum ('A1', 'A2', 'B1');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  english_level public.english_level not null default 'A2',
  goals text[] not null default '{}'
    check (goals <@ array['work', 'school', 'travel', 'daily']),
  daily_minutes_goal int not null default 10 check (daily_minutes_goal in (5, 10, 20)),
  baseline_confidence smallint check (baseline_confidence between 1 and 5),
  age_confirmed_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Read-only for signed-in users; all writes go through the server (service_role).
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

-- Create the profile with defaults when Auth creates a user (admin invite).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
