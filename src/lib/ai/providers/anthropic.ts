import Anthropic from "@anthropic-ai/sdk";

import {
  AiProviderError,
  type AiProvider,
  type CallOptions,
  type ReplyInput,
  type StructuredInput,
  type TokenUsage,
} from "../adapter.ts";
import * as conversation from "../prompts/conversation.v1.ts";

// Anthropic (Claude) candidate for Q-12. Used ONLY by the provider eval
// (scripts/eval-providers.mts) until M6 picks a provider; the app still runs
// the mock (src/lib/ai/provider.ts). The key is passed in by the caller and
// never read from a NEXT_PUBLIC_ variable.
//
// SDK: @anthropic-ai/sdk, Messages API. Thinking is always on for the current
// models; `effort` controls its depth. Structured output uses
// output_config.format (JSON schema). SDK retries are off so each call is
// measured once; the app's ≤ 2 attempts (ADR-002) are added in M6.
// Server-side refusal fallbacks are left off on purpose: a fallback would
// answer with a different model and skew the comparison. A refusal is
// recorded as a provider error.

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type AnthropicProviderOptions = {
  apiKey: string;
  model: string;
  replyEffort: Effort;
  structuredEffort: Effort;
  replyMaxTokens: number;
  structuredMaxTokens: number;
};

function usageOf(message: Anthropic.Message): TokenUsage {
  return { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };
}

function textOf(message: Anthropic.Message): string {
  if (message.stop_reason === "refusal") {
    throw new AiProviderError("provider_error", "refusal");
  }
  if (message.stop_reason === "max_tokens") {
    throw new AiProviderError("invalid_output", "max_tokens");
  }
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function failure(error: unknown, signal: AbortSignal): never {
  if (error instanceof AiProviderError) throw error;
  if (signal.aborted || error instanceof Anthropic.APIConnectionTimeoutError) {
    throw new AiProviderError("timeout");
  }
  if (error instanceof Anthropic.APIError) {
    throw new AiProviderError("provider_error", `HTTP ${error.status ?? "?"}`);
  }
  throw new AiProviderError("provider_error", error instanceof Error ? error.name : "unknown");
}

export function createAnthropicProvider(options: AnthropicProviderOptions): AiProvider {
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 0 });

  return {
    name: "anthropic",

    async reply(input: ReplyInput, { signal }: CallOptions) {
      const prompt = conversation.build(input);
      try {
        const message = await client.messages.create(
          {
            model: options.model,
            max_tokens: options.replyMaxTokens,
            system: prompt.system,
            messages: prompt.messages,
            output_config: { effort: options.replyEffort },
          },
          { signal },
        );
        return { text: textOf(message), usage: usageOf(message) };
      } catch (error) {
        failure(error, signal);
      }
    },

    async structured(input: StructuredInput, { signal }: CallOptions) {
      try {
        const message = await client.messages.create(
          {
            model: options.model,
            max_tokens: options.structuredMaxTokens,
            system: input.system,
            messages: [{ role: "user", content: input.user }],
            output_config: {
              effort: options.structuredEffort,
              format: { type: "json_schema", schema: input.jsonSchema },
            },
          },
          { signal },
        );
        const usage = usageOf(message);
        const text = textOf(message);
        try {
          return { data: JSON.parse(text) as unknown, usage };
        } catch {
          // Not JSON: return the text so the eval records it as schema-invalid.
          return { data: text, usage };
        }
      } catch (error) {
        failure(error, signal);
      }
    },
  };
}
