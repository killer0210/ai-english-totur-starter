-- Content keys (follow-up to 20261021090000_content.sql; docs/backend_schema.md §2.2).
-- 1. units get a stable slug: the content sync key (was english_level + position).
-- 2. Position uniqueness covers active rows only, so a deactivated unit or
--    scenario keeps its old position and a new row can take that slot.

alter table public.units add column slug text;
-- Rows synced before this migration: a deterministic slug so the column can be
-- not null. The sync deactivates any that are not in content/units.json.
update public.units set slug = lower(english_level::text) || '-' || position::text;
alter table public.units alter column slug set not null;
alter table public.units add constraint units_slug_key unique (slug);

alter table public.units drop constraint units_english_level_position_key;
create unique index units_active_position_key
  on public.units (english_level, position)
  where is_active;

alter table public.scenarios drop constraint scenarios_unit_id_position_key;
create unique index scenarios_active_position_key
  on public.scenarios (unit_id, position)
  where is_active;
-- The dropped constraint also indexed the unit_id foreign key.
create index scenarios_unit_id_idx on public.scenarios (unit_id);
