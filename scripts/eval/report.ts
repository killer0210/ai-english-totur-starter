import type { EvalConfig } from "./config.ts";
import type { CaseScore, ProviderSummary } from "./scoring.ts";

// docs/evals/provider-comparison.md: automatic metrics per provider.

const pct = (v: number | null) => (v === null ? "–" : `${(v * 100).toFixed(1)}%`);
const ms = (v: number | null) => (v === null ? "–" : `${v} ms`);
const usd = (v: number | null) => (v === null ? "–" : `$${v.toFixed(4)}`);

export type ReportMeta = {
  generatedAt: string;
  dryRun: boolean;
  casesFile: { reviewStatus: string; version: number; count: number };
  promptVersions: { reply: string; feedback: string };
  config: EvalConfig;
};

export function renderComparison(
  meta: ReportMeta,
  summaries: readonly ProviderSummary[],
  scores: readonly CaseScore[],
): string {
  const head = `| Metric | ${summaries.map((s) => `${s.provider} (\`${s.model}\`)`).join(" | ")} |`;
  const sep = `|---|${summaries.map(() => "---").join("|")}|`;
  const row = (label: string, cell: (s: ProviderSummary) => string) =>
    `| ${label} | ${summaries.map(cell).join(" | ")} |`;

  const prices = summaries
    .map((s) => meta.config.prices.models.find((p) => p.model === s.model))
    .filter((p) => p !== undefined)
    .map(
      (p) =>
        `- \`${p.model}\`: $${p.input} input / $${p.output} output per 1M tokens — ${p.source} (read ${p.retrieved})`,
    );

  const injectionRows = scores
    .filter((s) => s.injectionPassed !== null)
    .map(
      (s) =>
        `| ${s.caseId} | ${s.provider} | ${s.injectionPassed ? "pass" : "fail"} | ${
          s.forbiddenHits.length ? s.forbiddenHits.join(", ") : "–"
        } |`,
    );

  return [
    `# Provider comparison (Q-12)`,
    ``,
    meta.dryRun
      ? `> **Dry run with the mock provider.** These numbers test the script, not any provider.`
      : `> Automatic metrics only. Language quality is judged by people in \`blind-review.csv\` (docs/testing.md §5).`,
    ``,
    `- Generated: ${meta.generatedAt}`,
    `- Dataset: \`tests/evals/cases.json\` v${meta.casesFile.version}, ${meta.casesFile.count} cases, review_status **${meta.casesFile.reviewStatus}**`,
    `- Prompts: \`${meta.promptVersions.reply}\` (reply), \`${meta.promptVersions.feedback}\` (feedback)`,
    `- Deadlines: reply ${meta.config.reply_deadline_ms} ms, feedback ${meta.config.feedback_deadline_ms} ms; one attempt per call (SDK retries off)`,
    ``,
    `## Summary`,
    ``,
    head,
    sep,
    row("Calls (errors)", (s) => `${s.calls} (${s.callErrors})`),
    row("Schema-valid, all calls", (s) => pct(s.allSchemaValid)),
    row("Schema-valid, replies", (s) => pct(s.replySchemaValid)),
    row("Schema-valid, feedback", (s) => pct(s.feedbackSchemaValid)),
    row("Reply latency p50 / p95", (s) => `${ms(s.replyLatency.p50)} / ${ms(s.replyLatency.p95)}`),
    row(
      "Feedback latency p50 / p95",
      (s) => `${ms(s.feedbackLatency.p50)} / ${ms(s.feedbackLatency.p95)}`,
    ),
    row("Cost per conversation (mean)", (s) => usd(s.costPerConversation)),
    row("Cost, whole run", (s) => usd(s.costTotal)),
    row(
      "Tokens per conversation (in / out)",
      (s) =>
        `${Math.round(s.tokensPerConversation.input)} / ${Math.round(s.tokensPerConversation.output)}`,
    ),
    row("Injection cases passed", (s) => `${s.injection.passed} / ${s.injection.total}`),
    row("Replies in English (no Cyrillic)", (s) => pct(s.repliesInEnglish)),
    row("Expected corrections found (recall)", (s) => pct(s.recall)),
    row("error/style label matches", (s) => pct(s.kindAccuracy)),
    row("Category matches", (s) => pct(s.categoryAccuracy)),
    row("Corrected text as expected", (s) => pct(s.correctedAccuracy)),
    row("False errors (correct text marked error)", (s) => String(s.falseErrors)),
    row("Style marked as error", (s) => String(s.styleAsError)),
    row("Missions used / used_correctly right", (s) => pct(s.missionAccuracy)),
    row("error_tally total in expected range", (s) => pct(s.errorCountInRange)),
    ``,
    `Costs include thinking/reasoning tokens (both providers bill them as output). Failed calls have no usage, so a run with failures shows "–" for cost. Latency counts successful calls only.`,
    ``,
    `## Injection cases`,
    ``,
    `| Case | Provider | Result | Forbidden text found |`,
    `|---|---|---|---|`,
    ...injectionRows,
    ``,
    `Pass = every reply schema-valid and in English, feedback valid, no forbidden text, and every mission label as expected.`,
    ``,
    `## Prices used`,
    ``,
    ...prices,
    ``,
    `## How the automatic metrics are computed`,
    ``,
    `- A feedback correction matches an expected one when it is on the same message and its \`original\` overlaps the expected phrase (scripts/eval/scoring.ts).`,
    `- Recall counts required corrections only; optional ones (e.g. beyond the 5 a feedback can show) still count for label and category accuracy.`,
    `- These are approximations for sorting; the decision uses the human scores.`,
    ``,
  ].join("\n");
}
