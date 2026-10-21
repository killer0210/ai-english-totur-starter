import type { EnglishLevel } from "@/features/profile/schemas";

// AI provider adapter (ADR-002, docs/architecture.md §6). Feature code knows
// only these types; provider SDKs stay in src/lib/ai/providers/. `structured`
// (feedback, hint) is added with its first use in M7.

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ReplyInput = {
  /** The learner message being answered (stable across retries). */
  messageId: string;
  englishLevel: EnglishLevel;
  scenario: { aiRole: string; userRole: string; roleContext: string; introEn: string };
  /** Earlier turns, oldest first, ending with the learner message to answer. */
  history: ChatTurn[];
};

export type CallOptions = { signal: AbortSignal };

/** Raw provider output; validated with replySchema before it is stored. */
export type ReplyResult = { text: string };

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
}
