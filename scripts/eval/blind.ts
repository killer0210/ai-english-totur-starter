import type { EvalCase } from "./cases.ts";
import type { CaseRun } from "./run.ts";

// Blind human review (docs/evals/blind-review.csv). Per case, the two
// providers get the labels A and B in random order, so a reviewer cannot
// learn "A is always X". The key (label → provider) is written to a separate,
// gitignored file and only opened after scoring.

export type Labels = { A: string; B: string };
export type BlindKey = { seed: number; assignments: Record<string, Labels> };

/** Small seeded PRNG (mulberry32): the same seed gives the same labels. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function assignLabels(
  caseIds: readonly string[],
  providers: readonly [string, string],
  random: () => number,
): Record<string, Labels> {
  const [first, second] = providers;
  return Object.fromEntries(
    caseIds.map((id) => [id, random() < 0.5 ? { A: first, B: second } : { A: second, B: first }]),
  );
}

/** RFC 4180 field; cells that a spreadsheet would run as a formula get a leading '. */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

export const BLIND_HEADER = [
  "case_id",
  "system",
  "level",
  "scenario",
  "tags",
  "learner_messages",
  "ai_replies",
  "feedback_strengths",
  "feedback_corrections",
  "error_tally",
  "missions",
  "expected",
  "correctness_1_5",
  "mongolian_clarity_1_5",
  "labelling_ok_yes_no",
  "reviewer_notes",
] as const;

const numbered = (items: readonly (string | null)[]) =>
  items.map((text, i) => `[${i}] ${text ?? "(no valid reply)"}`).join("\n");

function expectedSummary(c: EvalCase): string {
  const lines = c.expected.corrections.map(
    (e) =>
      `[${e.message_index}] "${e.original}" → ${e.kind}/${e.category}` +
      (e.corrected_contains ? ` (e.g. ${e.corrected_contains.join(" | ")})` : "") +
      (e.optional ? " (optional)" : ""),
  );
  if (c.expected.no_error_in.length > 0) {
    lines.push(`no error in: ${c.expected.no_error_in.join(", ")}`);
  }
  lines.push(
    `missions: ${c.expected.missions
      .map((m) => `${m.key}=${m.used ? (m.used_correctly ? "used ok" : "used wrong") : "not used"}`)
      .join(", ")}`,
  );
  if (c.notes) lines.push(c.notes);
  return lines.join("\n");
}

function feedbackCells(run: CaseRun): string[] {
  const f = run.feedback;
  if (!f) {
    const raw = run.calls.find((c) => c.kind === "feedback");
    const detail = raw?.error ?? JSON.stringify(raw?.output ?? null).slice(0, 500);
    return [`(invalid feedback: ${detail})`, "", "", ""];
  }
  return [
    f.strengths_mn.map((s) => `• ${s}`).join("\n"),
    f.corrections
      .map(
        (c) =>
          `[${c.message_index}] ${c.original} → ${c.corrected} (${c.kind}, ${c.category}): ${c.explanation_mn}`,
      )
      .join("\n"),
    f.error_tally.map((t) => `${t.category}: ${t.count}`).join(", "),
    f.missions.map((m) => `${m.key}: used=${m.used} correctly=${m.used_correctly}`).join(", "),
  ];
}

/** Rows for every case, A then B; runs are keyed by case id and provider name. */
export function blindRows(
  cases: readonly EvalCase[],
  runs: readonly CaseRun[],
  assignments: Record<string, Labels>,
): string[][] {
  const rows: string[][] = [[...BLIND_HEADER]];
  for (const c of cases) {
    const labels = assignments[c.id];
    if (!labels) throw new Error(`No A/B assignment for case ${c.id}`);
    for (const label of ["A", "B"] as const) {
      const run = runs.find((r) => r.caseId === c.id && r.provider === labels[label]);
      if (!run) throw new Error(`No run for case ${c.id}, provider ${labels[label]}`);
      rows.push([
        c.id,
        label,
        c.level,
        c.scenario,
        c.tags.join(" "),
        numbered(c.learner_messages),
        numbered(run.replies),
        ...feedbackCells(run),
        expectedSummary(c),
        "",
        "",
        "",
        "",
      ]);
    }
  }
  return rows;
}
