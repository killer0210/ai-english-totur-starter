-- M4: content — units, scenarios, scenario_words (docs/backend_schema.md §2.2,
-- §2.5 normalize_term, §4; ADR-004). Written only by the content sync script
-- (scripts/upsert-content.mts, service_role); signed-in users read active rows.

-- Shared with vocabulary_items (M8). Mirrored in TS by normalizeTerm()
-- (src/features/path/content-schema.ts); integration tests compare the two.
create function public.normalize_term(t text)
returns text
language sql
immutable
set search_path = ''
as $$ select regexp_replace(lower(btrim(replace(t, '’', ''''))), '\s+', ' ', 'g') $$;

create table public.units (
  id uuid primary key default gen_random_uuid(),
  english_level public.english_level not null,
  position int not null,
  title_mn text not null,
  goal_tags text[] not null default '{}',
  is_active boolean not null default true,
  unique (english_level, position)
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id),
  position int not null,
  slug text unique not null,
  title_mn text not null,
  goal_mn text not null,
  ai_role text not null,
  user_role text not null,
  role_context text not null,
  intro_en text not null,
  english_level public.english_level not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, position)
);

create table public.scenario_words (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  position int not null,
  term text not null,
  normalized_term text not null generated always as (public.normalize_term(term)) stored,
  meaning_mn text not null,
  example_en text,
  unique (scenario_id, normalized_term)
);

-- unique (unit_id, position) and unique (scenario_id, normalized_term) already
-- index the FK columns (leading column), so no extra FK indexes are needed.

create trigger scenarios_set_updated_at
  before update on public.scenarios
  for each row execute function public.set_updated_at();

-- Read-only for signed-in users, active rows only; a row is visible only when
-- its parents are active too. No insert/update/delete policies; anon gets
-- nothing.
alter table public.units enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_words enable row level security;

create policy "read active units" on public.units
  for select to authenticated
  using (is_active);

create policy "read active scenarios" on public.scenarios
  for select to authenticated
  using (
    is_active
    and exists (select 1 from public.units u where u.id = unit_id and u.is_active)
  );

-- The scenarios policy applies inside this subquery, so it also checks the unit.
create policy "read words of active scenarios" on public.scenario_words
  for select to authenticated
  using (exists (select 1 from public.scenarios s where s.id = scenario_id));

revoke all on table public.units, public.scenarios, public.scenario_words from anon, authenticated;
grant select on table public.units, public.scenarios, public.scenario_words to authenticated;

revoke execute on function public.normalize_term(text) from public, anon, authenticated;
