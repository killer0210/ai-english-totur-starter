import { z } from "zod";

// Explicit .ts extension: scripts/upsert-content.mts runs this file directly in
// Node (type stripping), which resolves neither "@/" nor extensionless paths.
import { ENGLISH_LEVELS, GOALS } from "../profile/schemas.ts";

// Content files (D-11): content/units.json and content/scenarios/<slug>.json.
// Mirrors units / scenarios / scenario_words (docs/backend_schema.md §2.2);
// rules from docs/prd.md FR-03.

/** Same result as public.normalize_term() in SQL (docs/backend_schema.md §2.5). */
export function normalizeTerm(term: string): string {
  // btrim() without a character list strips spaces only (not tabs/newlines).
  return term
    .replaceAll("’", "'")
    .replace(/^ +| +$/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** "draft" until an English teacher has reviewed the file (prd.md FR-03). */
export const REVIEW_STATUSES = ["draft", "approved"] as const;

const text = z.string().trim().min(1);
const position = z.int().min(1);

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const unitSchema = z.strictObject({
  /** Stable identity (the sync key); never rename a synced unit's slug. */
  slug: z.string().regex(SLUG_PATTERN),
  english_level: z.enum(ENGLISH_LEVELS),
  position,
  title_mn: text,
  goal_tags: z.array(z.enum(GOALS)).default([]),
});

export const unitsFileSchema = z.strictObject({
  review_status: z.enum(REVIEW_STATUSES),
  units: z.array(unitSchema).min(1),
});

export const scenarioWordSchema = z.strictObject({
  term: text,
  meaning_mn: text,
  example_en: text,
});

export const scenarioFileSchema = z
  .strictObject({
    review_status: z.enum(REVIEW_STATUSES),
    slug: z.string().regex(SLUG_PATTERN),
    english_level: z.enum(ENGLISH_LEVELS),
    /** slug of a unit in content/units.json at the same english_level. */
    unit_slug: z.string().regex(SLUG_PATTERN),
    position,
    title_mn: text,
    goal_mn: text,
    ai_role: text,
    user_role: text,
    role_context: text,
    intro_en: text,
    words: z.array(scenarioWordSchema).min(3).max(6),
  })
  .superRefine((scenario, ctx) => {
    const seen = new Set<string>();
    scenario.words.forEach((word, index) => {
      const key = normalizeTerm(word.term);
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["words", index, "term"],
          message: `duplicate word "${word.term}"`,
        });
      }
      seen.add(key);
    });
  });

export type UnitContent = z.infer<typeof unitSchema>;
export type ScenarioContent = z.infer<typeof scenarioFileSchema>;
export type ScenarioWordContent = z.infer<typeof scenarioWordSchema>;

export const contentSetSchema = z
  .strictObject({
    units: unitsFileSchema,
    scenarios: z.array(scenarioFileSchema),
  })
  .superRefine(({ units, scenarios }, ctx) => {
    const unitLevels = new Map<string, string>();
    const unitPositions = new Set<string>();
    units.units.forEach((unit, index) => {
      if (unitLevels.has(unit.slug)) {
        ctx.addIssue({
          code: "custom",
          path: ["units", "units", index, "slug"],
          message: `duplicate unit slug "${unit.slug}"`,
        });
      }
      unitLevels.set(unit.slug, unit.english_level);
      const key = `${unit.english_level}/${unit.position}`;
      if (unitPositions.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["units", "units", index, "position"],
          message: `duplicate unit position ${key}`,
        });
      }
      unitPositions.add(key);
    });

    const slugs = new Set<string>();
    const positions = new Set<string>();
    scenarios.forEach((scenario, index) => {
      const unitLevel = unitLevels.get(scenario.unit_slug);
      if (unitLevel === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["scenarios", index, "unit_slug"],
          message: `no unit "${scenario.unit_slug}" for scenario "${scenario.slug}"`,
        });
      } else if (unitLevel !== scenario.english_level) {
        ctx.addIssue({
          code: "custom",
          path: ["scenarios", index, "english_level"],
          message: `scenario "${scenario.slug}" is ${scenario.english_level} but unit "${scenario.unit_slug}" is ${unitLevel}`,
        });
      }
      if (slugs.has(scenario.slug)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenarios", index, "slug"],
          message: `duplicate slug "${scenario.slug}"`,
        });
      }
      slugs.add(scenario.slug);
      const positionKey = `${scenario.unit_slug}/${scenario.position}`;
      if (positions.has(positionKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenarios", index, "position"],
          message: `duplicate position ${scenario.position} in unit "${scenario.unit_slug}"`,
        });
      }
      positions.add(positionKey);
    });
  });

export type ContentSet = z.infer<typeof contentSetSchema>;
