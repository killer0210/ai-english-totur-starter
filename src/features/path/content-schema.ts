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
export const REVIEW_STATUSES = ["draft", "reviewed"] as const;

const text = z.string().trim().min(1);
const position = z.int().min(1);

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const unitSchema = z.strictObject({
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
    /** The unit at the same english_level with this position. */
    unit_position: position,
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
    const unitKeys = new Set<string>();
    units.units.forEach((unit, index) => {
      const key = `${unit.english_level}/${unit.position}`;
      if (unitKeys.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["units", "units", index, "position"],
          message: `duplicate unit position ${key}`,
        });
      }
      unitKeys.add(key);
    });

    const slugs = new Set<string>();
    const positions = new Set<string>();
    scenarios.forEach((scenario, index) => {
      const unitKey = `${scenario.english_level}/${scenario.unit_position}`;
      if (!unitKeys.has(unitKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenarios", index, "unit_position"],
          message: `no unit ${unitKey} for scenario "${scenario.slug}"`,
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
      const positionKey = `${unitKey}/${scenario.position}`;
      if (positions.has(positionKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["scenarios", index, "position"],
          message: `duplicate position ${scenario.position} in unit ${unitKey}`,
        });
      }
      positions.add(positionKey);
    });
  });

export type ContentSet = z.infer<typeof contentSetSchema>;
