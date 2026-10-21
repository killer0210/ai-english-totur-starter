// Q-12 provider comparison (docs/evals/README.md). Runs every case in
// tests/evals/cases.json through both candidate providers with the same
// versioned prompts, then writes:
//   <out>/provider-comparison.md   automatic metrics per provider
//   <out>/blind-review.csv         outputs labelled A/B for human scoring
//   <out>/blind-review.key.json    the A/B key (gitignored; open after scoring)
//   <out>/provider-results.json    every call: latency, tokens, cost, validity, output
//
// Usage:
//   npm run eval:providers                 real providers (keys from .env.local), out = docs/evals
//   npm run eval:providers -- --dry-run    mock provider, no keys, out = test-results/eval-dry-run
//   options: --out <dir>  --seed <int>  --only <case-id,case-id>
//
// Keys: ANTHROPIC_API_KEY and OPENAI_API_KEY, server-side only. Models:
// tests/evals/config.json, or EVAL_ANTHROPIC_MODEL / EVAL_OPENAI_MODEL.
import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { loadContent } from "../src/features/path/content-sync.ts";
import { createAnthropicProvider } from "../src/lib/ai/providers/anthropic.ts";
import { createMockProvider } from "../src/lib/ai/providers/mock.ts";
import { createOpenAiProvider } from "../src/lib/ai/providers/openai.ts";

import { assignLabels, blindRows, seededRandom, toCsv } from "./eval/blind.ts";
import { checkCases, loadCases } from "./eval/cases.ts";
import { loadConfig, priceFor } from "./eval/config.ts";
import { renderComparison } from "./eval/report.ts";
import { PROMPT_VERSIONS, runCase, type CaseRun, type RunTarget } from "./eval/run.ts";
import { scoreCase, summarize } from "./eval/scoring.ts";

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    out: { type: "string" },
    seed: { type: "string" },
    only: { type: "string" },
  },
});
const dryRun = values["dry-run"];
const outDir = values.out ?? (dryRun ? "test-results/eval-dry-run" : "docs/evals");
const seed = values.seed === undefined ? randomInt(2 ** 31) : Number.parseInt(values.seed, 10);
if (!Number.isInteger(seed)) {
  console.error("--seed must be an integer");
  process.exit(1);
}

// Keys must never be public: refuse to run if one sits in a NEXT_PUBLIC_ variable.
const leaked = Object.keys(process.env).filter(
  (name) => name.startsWith("NEXT_PUBLIC_") && /ANTHROPIC|OPENAI/i.test(name),
);
if (leaked.length > 0) {
  console.error(`Provider keys must not be NEXT_PUBLIC_ variables: ${leaked.join(", ")}`);
  process.exit(1);
}

const config = await loadConfig();
const file = await loadCases();
const content = await loadContent("content");
const problems = checkCases(file.cases, content.scenarios);
if (problems.length > 0) {
  console.error(`tests/evals/cases.json:\n${problems.join("\n")}`);
  process.exit(1);
}
const only = values.only?.split(",").map((id) => id.trim());
const cases = only ? file.cases.filter((c) => only.includes(c.id)) : file.cases;
if (cases.length === 0) {
  console.error("No cases selected.");
  process.exit(1);
}

function targets(): [RunTarget, RunTarget] {
  if (dryRun) {
    const price = priceFor(config, "mock");
    return [
      { provider: createMockProvider("test", "mock-1"), model: "mock", price },
      { provider: createMockProvider("test", "mock-2"), model: "mock", price },
    ];
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey || !openaiKey) {
    console.error(
      "Set ANTHROPIC_API_KEY and OPENAI_API_KEY in .env.local (or run with --dry-run).",
    );
    process.exit(1);
  }
  const a = config.providers.anthropic;
  const o = config.providers.openai;
  const anthropicModel = process.env.EVAL_ANTHROPIC_MODEL || a.model;
  const openaiModel = process.env.EVAL_OPENAI_MODEL || o.model;
  return [
    {
      provider: createAnthropicProvider({
        apiKey: anthropicKey,
        model: anthropicModel,
        replyEffort: a.reply_effort,
        structuredEffort: a.feedback_effort,
        replyMaxTokens: a.reply_max_tokens,
        structuredMaxTokens: a.feedback_max_tokens,
      }),
      model: anthropicModel,
      price: priceFor(config, anthropicModel),
    },
    {
      provider: createOpenAiProvider({
        apiKey: openaiKey,
        model: openaiModel,
        replyEffort: o.reply_effort,
        structuredEffort: o.feedback_effort,
        replyMaxTokens: o.reply_max_tokens,
        structuredMaxTokens: o.feedback_max_tokens,
      }),
      model: openaiModel,
      price: priceFor(config, openaiModel),
    },
  ];
}

const pair = targets();
const options = {
  replyDeadlineMs: config.reply_deadline_ms,
  feedbackDeadlineMs: config.feedback_deadline_ms,
};
console.info(
  `${dryRun ? "Dry run" : "Eval"}: ${cases.length} cases × ${pair.map((t) => `${t.provider.name} (${t.model})`).join(" vs ")}`,
);

const runs: CaseRun[] = [];
for (const [i, evalCase] of cases.entries()) {
  const scenario = content.scenarios.find((s) => s.slug === evalCase.scenario);
  if (!scenario) throw new Error(`Unknown scenario ${evalCase.scenario}`);
  // Both providers in parallel; cases one after another to stay under rate limits.
  const pairRuns = await Promise.all(pair.map((t) => runCase(t, evalCase, scenario, options)));
  runs.push(...pairRuns);
  const status = pairRuns
    .map(
      (r) =>
        `${r.provider}: ${r.calls.filter((c) => c.error).length} errors, feedback ${r.feedback ? "ok" : "invalid"}`,
    )
    .join("; ");
  console.info(`[${i + 1}/${cases.length}] ${evalCase.id} — ${status}`);
}

const names = pair.map((t) => t.provider.name);
const scores = runs.map((run) => {
  const evalCase = cases.find((c) => c.id === run.caseId);
  if (!evalCase) throw new Error(`Unknown case ${run.caseId}`);
  return scoreCase(evalCase, run);
});
const summaries = names.map((name) =>
  summarize(
    runs.filter((r) => r.provider === name),
    scores.filter((s) => s.provider === name),
  ),
);
const assignments = assignLabels(
  cases.map((c) => c.id),
  [names[0] ?? "", names[1] ?? ""],
  seededRandom(seed),
);
const generatedAt = new Date().toISOString();

await mkdir(outDir, { recursive: true });
await writeFile(
  path.join(outDir, "provider-comparison.md"),
  renderComparison(
    {
      generatedAt,
      dryRun,
      casesFile: { reviewStatus: file.review_status, version: file.version, count: cases.length },
      promptVersions: PROMPT_VERSIONS,
      config,
    },
    summaries,
    scores,
  ),
);
await writeFile(path.join(outDir, "blind-review.csv"), toCsv(blindRows(cases, runs, assignments)));
await writeFile(
  path.join(outDir, "blind-review.key.json"),
  `${JSON.stringify({ seed, generatedAt, assignments }, null, 2)}\n`,
);
await writeFile(
  path.join(outDir, "provider-results.json"),
  `${JSON.stringify({ generatedAt, dryRun, promptVersions: PROMPT_VERSIONS, summaries, scores, runs }, null, 2)}\n`,
);
console.info(
  `Wrote ${outDir}/provider-comparison.md, blind-review.csv, blind-review.key.json, provider-results.json`,
);
