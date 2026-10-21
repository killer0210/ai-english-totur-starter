import { performance } from "node:perf_hooks";

import type { ScenarioContent } from "../../src/features/path/content-schema.ts";
import {
  AiProviderError,
  type AiProvider,
  type ChatTurn,
  type TokenUsage,
} from "../../src/lib/ai/adapter.ts";
import * as conversation from "../../src/lib/ai/prompts/conversation.v1.ts";
import * as feedbackPrompt from "../../src/lib/ai/prompts/feedback.v1.ts";
import { type Feedback, feedbackSchema, replySchema } from "../../src/lib/ai/schemas.ts";

import type { EvalCase } from "./cases.ts";
import { costUsd, type Price } from "./config.ts";

// Runs one eval case through one provider: each learner message gets a reply
// (the provider's own replies form the history, as in the app), then one
// feedback call over all learner messages. Every call is recorded.

export const PROMPT_VERSIONS = { reply: conversation.version, feedback: feedbackPrompt.version };

export type CallRecord = {
  kind: "reply" | "feedback";
  /** Learner message index for replies; null for feedback. */
  turn: number | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  schemaValid: boolean;
  /** "timeout", "provider_error: HTTP 429", …; null when the call returned. */
  error: string | null;
  /** Reply text or parsed feedback JSON as returned (before validation). */
  output: unknown;
};

export type CaseRun = {
  caseId: string;
  provider: string;
  model: string;
  calls: CallRecord[];
  /** Valid reply text per learner message (null: failed or invalid). */
  replies: (string | null)[];
  feedback: Feedback | null;
};

export type RunTarget = {
  provider: AiProvider;
  model: string;
  price: Price;
};

export type RunOptions = { replyDeadlineMs: number; feedbackDeadlineMs: number };

function describe(error: unknown): string {
  if (error instanceof AiProviderError) {
    return error.message === error.kind ? error.kind : `${error.kind}: ${error.message}`;
  }
  return error instanceof Error ? error.name : "unknown";
}

async function timed<T extends { usage?: TokenUsage }>(
  call: () => Promise<T>,
  price: Price,
): Promise<{
  result: T | null;
  record: Omit<CallRecord, "kind" | "turn" | "schemaValid" | "output">;
}> {
  const start = performance.now();
  try {
    const result = await call();
    const latencyMs = Math.round(performance.now() - start);
    const usage = result.usage;
    return {
      result,
      record: {
        latencyMs,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        costUsd: usage ? costUsd(usage, price) : null,
        error: null,
      },
    };
  } catch (error) {
    return {
      result: null,
      record: {
        latencyMs: Math.round(performance.now() - start),
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
        error: describe(error),
      },
    };
  }
}

export async function runCase(
  target: RunTarget,
  evalCase: EvalCase,
  scenario: ScenarioContent,
  options: RunOptions,
): Promise<CaseRun> {
  const scenarioInput = {
    aiRole: scenario.ai_role,
    userRole: scenario.user_role,
    roleContext: scenario.role_context,
    introEn: scenario.intro_en,
  };
  const calls: CallRecord[] = [];
  const replies: (string | null)[] = [];
  const history: ChatTurn[] = [];

  for (const [turn, content] of evalCase.learner_messages.entries()) {
    history.push({ role: "user", content });
    const { result, record } = await timed(
      () =>
        target.provider.reply(
          {
            messageId: `${evalCase.id}-${turn}`,
            englishLevel: evalCase.level,
            scenario: scenarioInput,
            history: [...history],
            missions: evalCase.missions,
          },
          { signal: AbortSignal.timeout(options.replyDeadlineMs) },
        ),
      target.price,
    );
    const parsed = result ? replySchema.safeParse(result) : null;
    calls.push({
      kind: "reply",
      turn,
      ...record,
      schemaValid: parsed?.success ?? false,
      output: result?.text ?? null,
    });
    const text = parsed?.success ? parsed.data.text : null;
    replies.push(text);
    if (text) history.push({ role: "assistant", content: text });
  }

  const prompt = feedbackPrompt.build({
    englishLevel: evalCase.level,
    scenario: scenarioInput,
    learnerMessages: evalCase.learner_messages,
    missions: evalCase.missions,
  });
  const { result, record } = await timed(
    () =>
      target.provider.structured(prompt, {
        signal: AbortSignal.timeout(options.feedbackDeadlineMs),
      }),
    target.price,
  );
  const parsed = result ? feedbackSchema.safeParse(result.data) : null;
  calls.push({
    kind: "feedback",
    turn: null,
    ...record,
    schemaValid: parsed?.success ?? false,
    output: result?.data ?? null,
  });

  return {
    caseId: evalCase.id,
    provider: target.provider.name,
    model: target.model,
    calls,
    replies,
    feedback: parsed?.success ? parsed.data : null,
  };
}
