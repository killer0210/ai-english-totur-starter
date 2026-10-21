import { readFile } from "node:fs/promises";

import { z } from "zod";

import { ENGLISH_LEVELS } from "../../src/features/profile/schemas.ts";
import { errorCategorySchema } from "../../src/lib/ai/schemas.ts";
import type { ScenarioContent } from "../../src/features/path/content-schema.ts";

// Eval dataset (tests/evals/cases.json, docs/testing.md §5): synthetic learner
// conversations with the labels a good feedback should produce. Imported by
// Node directly (npm run eval:providers), hence the explicit .ts extensions.

export const CASE_TAGS = [
  "correct",
  "tense",
  "article",
  "preposition",
  "word_order",
  "style",
  "ambiguous",
  "mixed_mn",
  "injection",
  "mission_correct",
  "mission_incorrect",
  "mission_inflected",
  "mission_injection",
  "multi_error",
] as const;

export type CaseTag = (typeof CASE_TAGS)[number];

const expectedCorrectionSchema = z.strictObject({
  message_index: z.int().nonnegative(),
  /** A phrase of the learner message the correction should cover. */
  original: z.string().min(1),
  /** The correction is right if `corrected` contains any of these (case-insensitive). */
  corrected_contains: z.array(z.string().min(1)).min(1).optional(),
  kind: z.enum(["error", "style"]),
  category: errorCategorySchema,
  /** Not counted in recall (e.g. beyond the 5 corrections a feedback can show). */
  optional: z.boolean().optional(),
});

export const evalCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  scenario: z.string().min(1),
  level: z.enum(ENGLISH_LEVELS),
  tags: z.array(z.enum(CASE_TAGS)).min(1),
  notes: z.string().optional(),
  /** Word mission terms from the scenario; key = position + 1. */
  missions: z.array(z.string().min(1)).min(1).max(3),
  learner_messages: z.array(z.string().trim().min(1).max(1000)).min(3).max(5),
  expected: z.strictObject({
    corrections: z.array(expectedCorrectionSchema),
    /** Messages where any "error"-kind correction is a false error. */
    no_error_in: z.array(z.int().nonnegative()),
    missions: z.array(
      z.strictObject({
        key: z.int().min(1).max(3),
        used: z.boolean(),
        used_correctly: z.boolean(),
      }),
    ),
    /** Range for the sum of error_tally counts. */
    error_count: z
      .strictObject({ min: z.int().nonnegative(), max: z.int().nonnegative() })
      .optional(),
    /** Must not appear (case-insensitive) in any reply or feedback text. */
    must_not_include: z.array(z.string().min(1)).optional(),
  }),
});

export const casesFileSchema = z.strictObject({
  review_status: z.enum(["draft", "approved"]),
  version: z.int().positive(),
  description: z.string(),
  cases: z.array(evalCaseSchema).min(1),
});

export type EvalCase = z.infer<typeof evalCaseSchema>;
export type ExpectedCorrection = z.infer<typeof expectedCorrectionSchema>;
export type CasesFile = z.infer<typeof casesFileSchema>;

export async function loadCases(file = "tests/evals/cases.json"): Promise<CasesFile> {
  return casesFileSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

/** Consistency problems between the cases and content/ (empty = fine). */
export function checkCases(cases: readonly EvalCase[], scenarios: readonly ScenarioContent[]) {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const c of cases) {
    const at = (msg: string) => problems.push(`${c.id}: ${msg}`);
    if (ids.has(c.id)) at("duplicate id");
    ids.add(c.id);

    const scenario = scenarios.find((s) => s.slug === c.scenario);
    if (!scenario) {
      at(`unknown scenario "${c.scenario}"`);
      continue;
    }
    if (scenario.english_level !== c.level)
      at(`level ${c.level} ≠ scenario ${scenario.english_level}`);
    const terms = new Set(scenario.words.map((w) => w.term));
    for (const term of c.missions)
      if (!terms.has(term)) at(`mission "${term}" is not a scenario word`);

    const n = c.learner_messages.length;
    const errorIn = new Set<number>();
    for (const e of c.expected.corrections) {
      const message = c.learner_messages[e.message_index];
      if (message === undefined) {
        at(`correction message_index ${e.message_index} out of range`);
      } else if (!message.toLowerCase().includes(e.original.toLowerCase())) {
        at(`"${e.original}" is not in message ${e.message_index}`);
      }
      if (e.kind === "error") errorIn.add(e.message_index);
    }
    for (const i of c.expected.no_error_in) {
      if (i >= n) at(`no_error_in ${i} out of range`);
      if (errorIn.has(i)) at(`message ${i} is in no_error_in but has an expected error`);
    }
    const keys = c.expected.missions.map((m) => m.key);
    if (new Set(keys).size !== keys.length) at("duplicate mission key");
    if (keys.length !== c.missions.length || keys.some((k) => k > c.missions.length)) {
      at("expected.missions must list each mission key once");
    }
    for (const m of c.expected.missions) {
      if (m.used_correctly && !m.used) at(`mission ${m.key}: used_correctly without used`);
    }
    const range = c.expected.error_count;
    if (range && range.min > range.max) at("error_count min > max");
  }
  return problems;
}
