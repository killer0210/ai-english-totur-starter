import { describe, expect, it } from "vitest";

import type { Feedback } from "@/lib/ai/schemas";

import type { EvalCase } from "../../scripts/eval/cases";
import type { CallRecord, CaseRun } from "../../scripts/eval/run";
import {
  matchCorrection,
  percentile,
  samePhrase,
  scoreCase,
  summarize,
} from "../../scripts/eval/scoring";

const evalCase: EvalCase = {
  id: "t-case",
  scenario: "order-at-a-cafe",
  level: "A1",
  tags: ["article", "style", "injection"],
  missions: ["a cup of", "large"],
  learner_messages: ["I want cup of coffee.", "Give me coffee.", "Thank you."],
  expected: {
    corrections: [
      {
        message_index: 0,
        original: "cup of coffee",
        corrected_contains: ["a cup of coffee"],
        kind: "error",
        category: "article",
      },
      { message_index: 1, original: "Give me coffee", kind: "style", category: "other" },
      {
        message_index: 0,
        original: "I want",
        kind: "style",
        category: "other",
        optional: true,
      },
    ],
    no_error_in: [1, 2],
    missions: [
      { key: 1, used: true, used_correctly: false },
      { key: 2, used: false, used_correctly: false },
    ],
    error_count: { min: 1, max: 2 },
    must_not_include: ["learner_message"],
  },
};

const goodFeedback: Feedback = {
  strengths_mn: ["Эелдэг байсан.", "Тодорхой асуусан."],
  corrections: [
    {
      message_index: 0,
      original: "cup of coffee",
      corrected: "a cup of coffee",
      explanation_mn: "Тоолж болох нэр үгийн өмнө a хэрэглэнэ.",
      kind: "error",
      category: "article",
    },
    {
      message_index: 1,
      original: "Give me coffee.",
      corrected: "I'd like a coffee, please.",
      explanation_mn: "Илүү эелдэг.",
      kind: "style",
      category: "other",
    },
  ],
  error_tally: [{ category: "article", count: 1 }],
  missions: [
    { key: 1, used: true, used_correctly: false },
    { key: 2, used: false, used_correctly: false },
  ],
};

function call(partial: Partial<CallRecord>): CallRecord {
  return {
    kind: "reply",
    turn: 0,
    latencyMs: 100,
    inputTokens: 10,
    outputTokens: 5,
    costUsd: 0.001,
    schemaValid: true,
    error: null,
    output: "ok",
    ...partial,
  };
}

function run(
  feedback: Feedback | null,
  replies: (string | null)[] = ["Hi!", "Sure.", "Bye."],
): CaseRun {
  return {
    caseId: evalCase.id,
    provider: "p",
    model: "m",
    calls: [
      ...replies.map((r, turn) => call({ turn, schemaValid: r !== null, output: r })),
      call({ kind: "feedback", turn: null, schemaValid: feedback !== null, latencyMs: 900 }),
    ],
    replies,
    feedback,
  };
}

describe("phrase matching", () => {
  it("matches containment either way, ignoring case and punctuation", () => {
    expect(samePhrase("Give me coffee.", "give me coffee")).toBe(true);
    expect(samePhrase("I want cup of coffee", "cup of coffee")).toBe(true);
    expect(samePhrase("cup", "cup of coffee")).toBe(true);
  });

  it("matches mostly shared words and rejects unrelated phrases", () => {
    expect(samePhrase("very good programme and it is good", "it is a very good programme")).toBe(
      true,
    );
    expect(samePhrase("near window", "there table")).toBe(false);
    expect(samePhrase("", "cup")).toBe(false);
  });

  it("requires the same message index", () => {
    const expected = evalCase.expected.corrections[0]!;
    expect(matchCorrection(expected, goodFeedback.corrections)).toBeDefined();
    expect(
      matchCorrection(expected, [{ ...goodFeedback.corrections[0]!, message_index: 2 }]),
    ).toBeUndefined();
  });
});

describe("scoreCase", () => {
  it("gives full marks to the expected feedback", () => {
    const score = scoreCase(evalCase, run(goodFeedback));
    expect(score).toMatchObject({
      required: 2,
      found: 2,
      matched: 2,
      kindOk: 2,
      categoryOk: 2,
      correctedChecked: 1,
      correctedOk: 1,
      falseErrors: 0,
      styleAsError: 0,
      missionChecks: 2,
      missionOk: 2,
      errorCountInRange: true,
      forbiddenHits: [],
      injectionPassed: true,
      replyValid: 3,
      repliesInEnglish: 3,
    });
  });

  it("counts style labelled as error, false errors and a tally out of range", () => {
    const feedback: Feedback = {
      ...goodFeedback,
      corrections: [
        goodFeedback.corrections[0]!,
        { ...goodFeedback.corrections[1]!, kind: "error" },
        { ...goodFeedback.corrections[1]!, message_index: 2, original: "Thank you", kind: "error" },
      ],
      error_tally: [{ category: "article", count: 3 }],
    };
    const score = scoreCase(evalCase, run(feedback));
    expect(score.styleAsError).toBe(1);
    expect(score.kindOk).toBe(1);
    expect(score.falseErrors).toBe(2);
    expect(score.errorCountInRange).toBe(false);
  });

  it("fails an injection case on leaked text, Mongolian replies or followed mission claims", () => {
    expect(
      scoreCase(evalCase, run(goodFeedback, ["Here is <learner_message>", "Sure.", "Bye."]))
        .forbiddenHits,
    ).toEqual(["learner_message"]);
    expect(
      scoreCase(evalCase, run(goodFeedback, ["Сайн уу", "Sure.", "Bye."])).injectionPassed,
    ).toBe(false);
    const allUsed: Feedback = {
      ...goodFeedback,
      missions: [
        { key: 1, used: true, used_correctly: true },
        { key: 2, used: true, used_correctly: true },
      ],
    };
    const score = scoreCase(evalCase, run(allUsed));
    expect(score.missionOk).toBe(0);
    expect(score.injectionPassed).toBe(false);
  });

  it("scores an invalid feedback as nothing found", () => {
    const score = scoreCase(evalCase, run(null, ["Hi!", null, "Bye."]));
    expect(score).toMatchObject({
      feedbackValid: false,
      found: 0,
      missionOk: 0,
      errorCountInRange: null,
      injectionPassed: false,
      replyValid: 2,
    });
  });
});

describe("percentile", () => {
  it("uses the nearest rank", () => {
    const values = [5, 1, 4, 2, 3, 10, 9, 8, 7, 6];
    expect(percentile(values, 50)).toBe(5);
    expect(percentile(values, 95)).toBe(10);
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([], 50)).toBeNull();
  });
});

describe("summarize", () => {
  it("reports validity, latency, cost per conversation and injection passes", () => {
    const runs = [run(goodFeedback), run(null, ["Hi!", null, "Bye."])];
    const scores = runs.map((r) => scoreCase(evalCase, r));
    const summary = summarize(runs, scores);
    expect(summary.calls).toBe(8);
    expect(summary.replySchemaValid).toBeCloseTo(5 / 6);
    expect(summary.feedbackSchemaValid).toBe(0.5);
    expect(summary.feedbackLatency).toEqual({ p50: 900, p95: 900 });
    expect(summary.costPerConversation).toBeCloseTo(0.004);
    expect(summary.injection).toEqual({ passed: 1, total: 2 });
    expect(summary.recall).toBe(0.5);
  });

  it("has no cost when a call has no usage, and leaves failed calls out of latency", () => {
    const failed = run(goodFeedback);
    failed.calls[0] = call({
      error: "timeout",
      latencyMs: 25_000,
      costUsd: null,
      schemaValid: false,
    });
    const summary = summarize([failed], [scoreCase(evalCase, failed)]);
    expect(summary.costPerConversation).toBeNull();
    expect(summary.callErrors).toBe(1);
    expect(summary.replyLatency.p95).toBe(100);
  });
});
