import OpenAI from "openai";

import {
  AiProviderError,
  type AiProvider,
  type CallOptions,
  type ReplyInput,
  type StructuredInput,
  type TokenUsage,
} from "../adapter.ts";
import * as conversation from "../prompts/conversation.v1.ts";

// OpenAI candidate for Q-12. Used ONLY by the provider eval
// (scripts/eval-providers.mts) until M6 picks a provider; the app still runs
// the mock (src/lib/ai/provider.ts). The key is passed in by the caller and
// never read from a NEXT_PUBLIC_ variable.
//
// SDK: openai, Responses API. `reasoning.effort` controls reasoning depth;
// structured output uses text.format (strict JSON schema). `store: false` so
// conversations are not kept by the Responses API. SDK retries are off so
// each call is measured once; the app's ≤ 2 attempts (ADR-002) come in M6.

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

export type OpenAiProviderOptions = {
  apiKey: string;
  model: string;
  replyEffort: ReasoningEffort;
  structuredEffort: ReasoningEffort;
  replyMaxTokens: number;
  structuredMaxTokens: number;
};

function usageOf(response: OpenAI.Responses.Response): TokenUsage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

function textOf(response: OpenAI.Responses.Response): string {
  if (response.status === "incomplete") {
    throw new AiProviderError(
      "invalid_output",
      response.incomplete_details?.reason ?? "incomplete",
    );
  }
  if (response.status !== "completed") {
    throw new AiProviderError("provider_error", response.status ?? "unknown");
  }
  return response.output_text;
}

function failure(error: unknown, signal: AbortSignal): never {
  if (error instanceof AiProviderError) throw error;
  if (signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError) {
    throw new AiProviderError("timeout");
  }
  if (error instanceof OpenAI.APIError) {
    throw new AiProviderError("provider_error", `HTTP ${error.status ?? "?"}`);
  }
  throw new AiProviderError("provider_error", error instanceof Error ? error.name : "unknown");
}

export function createOpenAiProvider(options: OpenAiProviderOptions): AiProvider {
  const client = new OpenAI({ apiKey: options.apiKey, maxRetries: 0 });

  return {
    name: "openai",

    async reply(input: ReplyInput, { signal }: CallOptions) {
      const prompt = conversation.build(input);
      try {
        const response = await client.responses.create(
          {
            model: options.model,
            instructions: prompt.system,
            input: prompt.messages,
            max_output_tokens: options.replyMaxTokens,
            reasoning: { effort: options.replyEffort },
            store: false,
          },
          { signal },
        );
        return { text: textOf(response), usage: usageOf(response) };
      } catch (error) {
        failure(error, signal);
      }
    },

    async structured(input: StructuredInput, { signal }: CallOptions) {
      try {
        const response = await client.responses.create(
          {
            model: options.model,
            instructions: input.system,
            input: input.user,
            max_output_tokens: options.structuredMaxTokens,
            reasoning: { effort: options.structuredEffort },
            store: false,
            text: {
              format: {
                type: "json_schema",
                name: input.schemaName,
                schema: input.jsonSchema,
                strict: true,
              },
            },
          },
          { signal },
        );
        const usage = usageOf(response);
        const text = textOf(response);
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
