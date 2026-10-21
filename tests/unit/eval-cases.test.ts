import { beforeAll, describe, expect, it } from "vitest";

import type { ScenarioContent } from "@/features/path/content-schema";
import { loadContent } from "@/features/path/content-sync";

import { CASE_TAGS, type CasesFile, checkCases, loadCases } from "../../scripts/eval/cases";
import { loadConfig, priceFor } from "../../scripts/eval/config";

// The eval dataset itself (tests/evals/cases.json) against docs/testing.md §5.
let file: CasesFile;
let scenarios: ScenarioContent[];

beforeAll(async () => {
  file = await loadCases();
  scenarios = (await loadContent("content")).scenarios;
});

describe("tests/evals/cases.json", () => {
  it("is a draft of 30 synthetic conversations with 3–5 learner messages", () => {
    expect(file.review_status).toBe("draft");
    expect(file.cases).toHaveLength(30);
    for (const c of file.cases) {
      expect(c.learner_messages.length).toBeGreaterThanOrEqual(3);
      expect(c.learner_messages.length).toBeLessThanOrEqual(5);
    }
  });

  it("is consistent with content/ (scenarios, levels, mission words, indexes)", () => {
    expect(checkCases(file.cases, scenarios)).toEqual([]);
  });

  it("covers every testing.md §5 category, with at least 3 injection cases", () => {
    const count = (tag: string) => file.cases.filter((c) => c.tags.some((t) => t === tag)).length;
    for (const tag of CASE_TAGS) expect(count(tag), tag).toBeGreaterThan(0);
    expect(count("injection")).toBeGreaterThanOrEqual(3);
    expect(count("style")).toBeGreaterThanOrEqual(3);
  });

  it("spreads over A1, A2 and B1 and uses every scenario", () => {
    for (const level of ["A1", "A2", "B1"]) {
      expect(file.cases.filter((c) => c.level === level).length).toBeGreaterThanOrEqual(8);
    }
    expect(new Set(file.cases.map((c) => c.scenario))).toEqual(
      new Set(scenarios.map((s) => s.slug)),
    );
  });
});

describe("checkCases", () => {
  it("reports inconsistent cases", () => {
    const base = file.cases[0]!;
    const broken = [
      { ...base, level: "B1" as const },
      {
        ...base,
        id: "other",
        missions: ["not a word"],
        expected: {
          ...base.expected,
          corrections: [
            { message_index: 9, original: "x", kind: "error" as const, category: "other" as const },
            {
              message_index: 0,
              original: "missing phrase",
              kind: "error" as const,
              category: "other" as const,
            },
          ],
          no_error_in: [0],
        },
      },
      base,
    ];
    const problems = checkCases(broken, scenarios).join("\n");
    expect(problems).toMatch(/level B1/);
    expect(problems).toMatch(/not a scenario word/);
    expect(problems).toMatch(/out of range/);
    expect(problems).toMatch(/is not in message 0/);
    expect(problems).toMatch(/no_error_in but has an expected error/);
    expect(problems).toMatch(/duplicate id/);
  });
});

describe("tests/evals/config.json", () => {
  it("has a dated, sourced price for each default model", async () => {
    const config = await loadConfig();
    for (const model of [config.providers.anthropic.model, config.providers.openai.model, "mock"]) {
      const price = priceFor(config, model);
      expect(price.source).toBeTruthy();
      expect(price.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(() => priceFor(config, "unknown-model")).toThrow(/No price/);
  });
});
