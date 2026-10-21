import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

// Explicit .ts extensions: run directly by Node (scripts/upsert-content.mts).
import {
  type ContentSet,
  contentSetSchema,
  normalizeTerm,
  scenarioFileSchema,
  unitsFileSchema,
} from "./content-schema.ts";

// Content sync (D-11, ADR-005): content/ files → units, scenarios,
// scenario_words, through a service_role client. Idempotent, keyed by
// english_level + position for units (they have no slug) and by slug for
// scenarios. Never deletes: rows missing from the files become
// is_active = false. A second run with the same files writes nothing.

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentError";
  }
}

function formatIssues(file: string, issues: { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => `${file}: ${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new ContentError(`${file}: ${(error as Error).message}`);
  }
}

/** Reads and validates content/units.json and content/scenarios/*.json. */
export async function loadContent(root = "content"): Promise<ContentSet> {
  const problems: string[] = [];

  const unitsFile = path.join(root, "units.json");
  const units = unitsFileSchema.safeParse(await readJson(unitsFile));
  if (!units.success) problems.push(formatIssues(unitsFile, units.error.issues));

  const dir = path.join(root, "scenarios");
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  const scenarios = [];
  for (const name of names) {
    const file = path.join(dir, name);
    const parsed = scenarioFileSchema.safeParse(await readJson(file));
    if (!parsed.success) {
      problems.push(formatIssues(file, parsed.error.issues));
    } else if (`${parsed.data.slug}.json` !== name) {
      problems.push(`${file}: file name must be "${parsed.data.slug}.json"`);
    } else {
      scenarios.push(parsed.data);
    }
  }
  if (problems.length > 0) throw new ContentError(problems.join("\n"));

  const set = contentSetSchema.safeParse({ units: units.data, scenarios });
  if (!set.success) throw new ContentError(formatIssues(root, set.error.issues));
  return set.data;
}

type UnitRow = {
  id: string;
  english_level: string;
  position: number;
  title_mn: string;
  goal_tags: string[];
  is_active: boolean;
};

const SCENARIO_FIELDS = [
  "title_mn",
  "goal_mn",
  "ai_role",
  "user_role",
  "role_context",
  "intro_en",
  "english_level",
] as const;

type ScenarioRow = {
  id: string;
  unit_id: string;
  position: number;
  slug: string;
  is_active: boolean;
} & Record<(typeof SCENARIO_FIELDS)[number], string>;

type WordRow = {
  id: string;
  scenario_id: string;
  position: number;
  term: string;
  normalized_term: string;
  meaning_mn: string;
  example_en: string | null;
};

async function check<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  what: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as T;
}

const unitKey = (level: string, position: number) => `${level}/${position}`;
const slotKey = (unitId: string, position: number) => `${unitId}/${position}`;

/**
 * Applies `content` to the database. Returns one line per write; an empty
 * list means the database already matched the files.
 */
export async function syncContent(db: SupabaseClient, content: ContentSet): Promise<string[]> {
  const changes: string[] = [];

  const [units, scenarios, words] = await Promise.all([
    check<UnitRow[]>(
      db.from("units").select("id, english_level, position, title_mn, goal_tags, is_active"),
      "read units",
    ),
    check<ScenarioRow[]>(
      db.from("scenarios").select(`id, unit_id, position, slug, is_active, ${SCENARIO_FIELDS}`),
      "read scenarios",
    ),
    check<WordRow[]>(
      db
        .from("scenario_words")
        .select("id, scenario_id, position, term, normalized_term, meaning_mn, example_en"),
      "read scenario_words",
    ),
  ]);

  // Never delete words: a word removed from a scenario that is already in the
  // database stops the sync before any write (it may be referenced by
  // session_target_words from M9). Remove it with a reviewed migration.
  const scenarioBySlug = new Map(scenarios.map((s) => [s.slug, s]));
  const removedWords: string[] = [];
  for (const scenario of content.scenarios) {
    const existing = scenarioBySlug.get(scenario.slug);
    if (!existing) continue;
    const wanted = new Set(scenario.words.map((w) => normalizeTerm(w.term)));
    for (const word of words) {
      if (word.scenario_id === existing.id && !wanted.has(word.normalized_term)) {
        removedWords.push(`${scenario.slug}: "${word.term}"`);
      }
    }
  }
  if (removedWords.length > 0) {
    throw new ContentError(
      `Words were removed from scenarios that are already in the database; the sync never deletes:\n${removedWords.join("\n")}`,
    );
  }

  // Units: identity is (english_level, position).
  const unitIdByKey = new Map(units.map((u) => [unitKey(u.english_level, u.position), u.id]));
  const wantedUnits = new Set<string>();
  for (const unit of content.units.units) {
    const key = unitKey(unit.english_level, unit.position);
    wantedUnits.add(key);
    const existing = units.find((u) => u.id === unitIdByKey.get(key));
    if (!existing) {
      const [row] = await check<{ id: string }[]>(
        db.from("units").insert(unit).select("id"),
        `insert unit ${key}`,
      );
      unitIdByKey.set(key, row!.id);
      changes.push(`insert unit ${key}`);
    } else if (
      existing.title_mn !== unit.title_mn ||
      JSON.stringify(existing.goal_tags) !== JSON.stringify(unit.goal_tags) ||
      !existing.is_active
    ) {
      await check(
        db
          .from("units")
          .update({ title_mn: unit.title_mn, goal_tags: unit.goal_tags, is_active: true })
          .eq("id", existing.id),
        `update unit ${key}`,
      );
      changes.push(`update unit ${key}`);
    }
  }
  for (const unit of units) {
    const key = unitKey(unit.english_level, unit.position);
    if (unit.is_active && !wantedUnits.has(key)) {
      await check(
        db.from("units").update({ is_active: false }).eq("id", unit.id),
        `deactivate unit ${key}`,
      );
      changes.push(`deactivate unit ${key}`);
    }
  }

  // Scenarios: identity is the slug; (unit_id, position) is unique, also for
  // inactive rows. Rows that must leave a slot first move to a free negative
  // position in their unit (removed scenarios stay parked there), then the
  // wanted rows take their final slots.
  const wanted = content.scenarios.map((scenario) => ({
    scenario,
    unitId: unitIdByKey.get(unitKey(scenario.english_level, scenario.unit_position))!,
  }));
  const targetSlots = new Map(wanted.map((w) => [slotKey(w.unitId, w.scenario.position), w]));
  const wantedBySlug = new Map(wanted.map((w) => [w.scenario.slug, w]));

  const nextFree = new Map<string, number>();
  const freePosition = (unitId: string) => {
    const lowest =
      nextFree.get(unitId) ??
      Math.min(0, ...scenarios.filter((s) => s.unit_id === unitId).map((s) => s.position));
    nextFree.set(unitId, lowest - 1);
    return lowest - 1;
  };

  for (const row of scenarios) {
    const want = wantedBySlug.get(row.slug);
    const moving = want && (want.unitId !== row.unit_id || want.scenario.position !== row.position);
    const occupant = targetSlots.get(slotKey(row.unit_id, row.position));
    const blocking = !want && occupant !== undefined;
    if (moving || blocking) {
      const parked = freePosition(row.unit_id);
      const update = blocking ? { position: parked, is_active: false } : { position: parked };
      await check(
        db.from("scenarios").update(update).eq("id", row.id),
        `move scenario ${row.slug}`,
      );
      if (blocking && row.is_active) changes.push(`deactivate scenario ${row.slug}`);
      else changes.push(`move scenario ${row.slug}`);
      row.position = parked;
      if (blocking) row.is_active = false;
    }
  }

  for (const { scenario, unitId } of wanted) {
    const values = {
      unit_id: unitId,
      position: scenario.position,
      slug: scenario.slug,
      is_active: true,
      ...Object.fromEntries(SCENARIO_FIELDS.map((field) => [field, scenario[field]])),
    };
    const existing = scenarioBySlug.get(scenario.slug);
    let scenarioId: string;
    if (!existing) {
      const [row] = await check<{ id: string }[]>(
        db.from("scenarios").insert(values).select("id"),
        `insert scenario ${scenario.slug}`,
      );
      scenarioId = row!.id;
      changes.push(`insert scenario ${scenario.slug}`);
    } else {
      scenarioId = existing.id;
      const differs =
        existing.unit_id !== unitId ||
        existing.position !== scenario.position ||
        !existing.is_active ||
        SCENARIO_FIELDS.some((field) => existing[field] !== scenario[field]);
      if (differs) {
        await check(
          db.from("scenarios").update(values).eq("id", existing.id),
          `update scenario ${scenario.slug}`,
        );
        changes.push(`update scenario ${scenario.slug}`);
      }
    }

    const existingWords = new Map(
      words.filter((w) => w.scenario_id === scenarioId).map((w) => [w.normalized_term, w]),
    );
    for (const [index, word] of scenario.words.entries()) {
      const values = {
        position: index + 1,
        term: word.term,
        meaning_mn: word.meaning_mn,
        example_en: word.example_en,
      };
      const current = existingWords.get(normalizeTerm(word.term));
      if (!current) {
        await check(
          db.from("scenario_words").insert({ scenario_id: scenarioId, ...values }),
          `insert word ${scenario.slug}/${word.term}`,
        );
        changes.push(`insert word ${scenario.slug}: ${word.term}`);
      } else if (
        current.position !== values.position ||
        current.term !== values.term ||
        current.meaning_mn !== values.meaning_mn ||
        current.example_en !== values.example_en
      ) {
        await check(
          db.from("scenario_words").update(values).eq("id", current.id),
          `update word ${scenario.slug}/${word.term}`,
        );
        changes.push(`update word ${scenario.slug}: ${word.term}`);
      }
    }
  }

  for (const row of scenarios) {
    if (row.is_active && !wantedBySlug.has(row.slug)) {
      await check(
        db.from("scenarios").update({ is_active: false }).eq("id", row.id),
        `deactivate scenario ${row.slug}`,
      );
      changes.push(`deactivate scenario ${row.slug}`);
    }
  }

  return changes;
}
