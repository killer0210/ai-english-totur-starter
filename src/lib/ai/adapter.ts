import type { EnglishLevel } from "@/features/profile/schemas";

// AI provider adapter (ADR-002, docs/architecture.md §6). Feature code knows
// only these types; provider SDKs stay in src/lib/ai/providers/. `structured`
// (feedback, hint) is used by the provider eval (scripts/eval/) until M7.
// Imported directly by Node (npm run eval:providers): relative value imports
// need explicit .ts extensions.

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ReplyInput = {
  /** The learner message being answered (stable across retries). */
  messageId: string;
  englishLevel: EnglishLevel;
  scenario: { aiRole: string; userRole: string; roleContext: string; introEn: string };
  /** Earlier turns, oldest first, ending with the learner message to answer. */
  history: ChatTurn[];
  /** Word mission terms for this session (M7 stores them; the eval passes them). */
  missions?: readonly string[];
};

export type CallOptions = { signal: AbortSignal };

/** Tokens billed for one call; reasoning/thinking tokens count as output. */
export type TokenUsage = { inputTokens: number; outputTokens: number };

/** Raw provider output; validated with replySchema before it is stored. */
export type ReplyResult = { text: string; usage?: TokenUsage };

/** A prompt built by src/lib/ai/prompts/ plus the JSON schema the output must follow. */
export type StructuredInput = {
  system: string;
  user: string;
  schemaName: string;
  /** Provider-neutral JSON schema (no length/number constraints; Zod checks those). */
  jsonSchema: Record<string, unknown>;
};

/** Parsed JSON, not yet validated: the caller checks it with the Zod schema. */
export type StructuredResult = { data: unknown; usage?: TokenUsage };

export type AiFailure = "timeout" | "provider_error" | "invalid_output";

/** Provider failures. Details stay on the server; clients see AI_UNAVAILABLE. */
export class AiProviderError extends Error {
  readonly kind: AiFailure;

  constructor(kind: AiFailure, message: string = kind) {
    super(message);
    this.name = "AiProviderError";
    this.kind = kind;
  }
}

export interface AiProvider {
  readonly name: string;
  reply(input: ReplyInput, options: CallOptions): Promise<ReplyResult>;
  structured(input: StructuredInput, options: CallOptions): Promise<StructuredResult>;
}
