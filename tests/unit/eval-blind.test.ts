import { describe, expect, it } from "vitest";

import { assignLabels, blindRows, csvField, seededRandom, toCsv } from "../../scripts/eval/blind";
import type { EvalCase } from "../../scripts/eval/cases";
import type { CaseRun } from "../../scripts/eval/run";

const ids = Array.from({ length: 40 }, (_, i) => `case-${i}`);
const providers = ["anthropic", "openai"] as const;

describe("A/B assignment", () => {
  it("is reproducible from the seed and differs between seeds", () => {
    const a = assignLabels(ids, providers, seededRandom(7));
    expect(assignLabels(ids, providers, seededRandom(7))).toEqual(a);
    expect(assignLabels(ids, providers, seededRandom(8))).not.toEqual(a);
  });

  it("gives each case both providers, in both orders across cases", () => {
    const assignments = assignLabels(ids, providers, seededRandom(123));
    const firstAsA = Object.values(assignments).filter((l) => l.A === "anthropic").length;
    for (const labels of Object.values(assignments)) {
      expect([labels.A, labels.B].toSorted()).toEqual(["anthropic", "openai"]);
    }
    expect(firstAsA).toBeGreaterThan(5);
    expect(firstAsA).toBeLessThan(35);
  });

  it("produces values in [0, 1)", () => {
    const random = seededRandom(1);
    for (let i = 0; i < 1000; i++) {
      const v = random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("CSV", () => {
  it("quotes commas, quotes and line breaks (RFC 4180)", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvField("a\nb")).toBe('"a\nb"');
  });

  it("neutralises cells a spreadsheet would run as formulas", () => {
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("-")).toBe("'-");
    expect(csvField("@x")).toBe("'@x");
  });

  it("ends every row with CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBe("a,b\r\nc,d\r\n");
  });
});

describe("blindRows", () => {
  const evalCase: EvalCase = {
    id: "c1",
    scenario: "order-at-a-cafe",
    level: "A1",
    tags: ["correct"],
    missions: ["large"],
    learner_messages: ["A large tea.", "Thanks.", "Bye."],
    expected: {
      corrections: [],
      no_error_in: [0, 1, 2],
      missions: [{ key: 1, used: true, used_correctly: true }],
    },
  };
  const runFor = (provider: string, reply: string): CaseRun => ({
    caseId: "c1",
    provider,
    model: `${provider}-model`,
    calls: [],
    replies: [reply, reply, reply],
    feedback: {
      strengths_mn: ["Сайн.", "Тодорхой."],
      corrections: [],
      error_tally: [],
      missions: [{ key: 1, used: true, used_correctly: true }],
    },
  });
  const runs = [runFor("anthropic", "Reply from one"), runFor("openai", "Reply from two")];

  it("puts each provider's output under its label and never the provider name", () => {
    const rows = blindRows([evalCase], runs, { c1: { A: "openai", B: "anthropic" } });
    expect(rows).toHaveLength(3);
    const [header, a, b] = rows;
    const replies = header!.indexOf("ai_replies");
    expect(a![1]).toBe("A");
    expect(a![replies]).toContain("Reply from two");
    expect(b![replies]).toContain("Reply from one");
    const text = toCsv(rows);
    expect(text).not.toMatch(/anthropic|openai/i);
    // Score columns are left empty for the reviewer.
    expect(a!.slice(header!.indexOf("correctness_1_5"))).toEqual(["", "", "", ""]);
  });

  it("fails loudly when a case has no assignment or run", () => {
    expect(() => blindRows([evalCase], runs, {})).toThrow(/assignment/);
    expect(() =>
      blindRows([evalCase], runs.slice(0, 1), { c1: { A: "openai", B: "anthropic" } }),
    ).toThrow(/No run/);
  });
});
