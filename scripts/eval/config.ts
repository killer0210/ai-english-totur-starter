import { readFile } from "node:fs/promises";

import { z } from "zod";

import type { TokenUsage } from "../../src/lib/ai/adapter.ts";

// Eval settings and model prices (tests/evals/config.json). Prices are copied
// by hand from the providers' pricing pages; every entry names its source URL
// and the date it was read. A model without a price stops the run, so a cost
// is never silently reported as zero.

const effort = z.enum(["low", "medium", "high", "xhigh", "max"]);

const providerSettingsSchema = z.strictObject({
  model: z.string().min(1),
  reply_effort: effort,
  feedback_effort: effort,
  reply_max_tokens: z.int().positive(),
  feedback_max_tokens: z.int().positive(),
});

const priceSchema = z.strictObject({
  model: z.string().min(1),
  /** USD per 1M input tokens. */
  input: z.number().nonnegative(),
  /** USD per 1M output tokens (thinking/reasoning tokens are billed as output). */
  output: z.number().nonnegative(),
  source: z.string().min(1),
  retrieved: z.iso.date(),
});

export const evalConfigSchema = z.strictObject({
  reply_deadline_ms: z.int().positive(),
  feedback_deadline_ms: z.int().positive(),
  providers: z.strictObject({ anthropic: providerSettingsSchema, openai: providerSettingsSchema }),
  prices: z.strictObject({
    currency: z.literal("USD"),
    unit: z.string(),
    models: z.array(priceSchema).min(1),
  }),
});

export type EvalConfig = z.infer<typeof evalConfigSchema>;
export type ProviderSettings = z.infer<typeof providerSettingsSchema>;
export type Price = z.infer<typeof priceSchema>;

export async function loadConfig(file = "tests/evals/config.json"): Promise<EvalConfig> {
  return evalConfigSchema.parse(JSON.parse(await readFile(file, "utf8")));
}

export function priceFor(config: EvalConfig, model: string): Price {
  const price = config.prices.models.find((p) => p.model === model);
  if (!price) throw new Error(`No price for model "${model}" in tests/evals/config.json`);
  return price;
}

export function costUsd(usage: TokenUsage, price: Price): number {
  return (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
}
