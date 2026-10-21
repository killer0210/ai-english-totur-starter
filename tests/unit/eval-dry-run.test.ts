import { beforeAll, describe, expect, it } from "vitest";

import type { ScenarioContent } from "@/features/path/content-schema";
import { loadContent } from "@/features/path/content-sync";
import { createMockProvider } from "@/lib/ai/providers/mock";

import { type CasesFile, loadCases } from "../../scripts/eval/cases";
import { runCase, type RunTarget } from "../../scripts/eval/run";
import { scoreCase, summarize } from "../../scripts/eval/scoring";

// The eval pipeline with the mock provider (what --dry-run does), no keys.
let file: CasesFile;
let scenarios: ScenarioContent[];
const price = { model: "mock", input: 1, output: 2, source: "test", retrieved: "2026-10-21" };
const options = { replyDeadlineMs: 1000, feedbackDeadlineMs: 1000 };

beforeAll(async () => {
  file = await loadCases();
  scenarios = (await loadContent("content")).scenarios;
});

const scenarioOf = (slug: string) => scenarios.find((s) => s.slug === slug)!;

describe("eval dry run", () => {
  it("runs every case: one reply per learner message plus one feedback, all recorded", async () => {
    const target: RunTarget = { provider: createMockProvider("test"), model: "mock", price };
    const runs = await Promise.all(
      file.cases.map((c) => runCase(target, c, scenarioOf(c.scenario), options)),
    );
    for (const [i, run] of runs.entries()) {
      const c = file.cases[i]!;
      expect(run.calls).toHaveLength(c.learner_messages.length + 1);
      expect(run.calls.every((call) => call.schemaValid && call.error === null)).toBe(true);
      expect(run.calls.every((call) => (call.costUsd ?? -1) >= 0)).toBe(true);
      expect(run.feedback).not.toBeNull();
    }
    const summary = summarize(
      runs,
      runs.map((r, i) => scoreCase(file.cases[i]!, r)),
    );
    expect(summary.allSchemaValid).toBe(1);
    expect(summary.injection.total).toBeGreaterThanOrEqual(3);
    expect(summary.costPerConversation).toBeGreaterThan(0);
  });

  it("records failures and invalid output instead of stopping", async () => {
    const target: RunTarget = { provider: createMockProvider("test"), model: "mock", price };
    const base = file.cases[0]!;
    const run = await runCase(
      target,
      {
        ...base,
        learner_messages: ["[mock:timeout] hi", "[mock:invalid] hi", "[mock:error] hi"],
      },
      scenarioOf(base.scenario),
      options,
    );
    expect(run.calls.map((c) => c.error)).toEqual(["timeout", null, "provider_error", "timeout"]);
    expect(run.calls.map((c) => c.schemaValid)).toEqual([false, false, false, false]);
    expect(run.replies).toEqual([null, null, null]);
    expect(run.feedback).toBeNull();
    expect(run.calls[0]?.costUsd).toBeNull();
  });
});
