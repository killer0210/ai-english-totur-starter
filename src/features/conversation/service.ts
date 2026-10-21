import { AiProviderError, type AiProvider } from "@/lib/ai/adapter";
import { replySchema } from "@/lib/ai/schemas";
import { logger } from "@/lib/logger";

import {
  beginRetry,
  beginUserTurn,
  completeSession,
  finishUserTurn,
  getReplyInput,
  startSession,
} from "./data";
import { staleAfterMs } from "./state";
import type { SessionState, TurnResult } from "./types";

// Conversation service (docs/architecture.md §4): the learner message is
// stored as pending before the provider is called (ADR-003); the provider
// result or failure is then recorded by finish_user_turn. No Next.js imports.

export type ConversationConfig = { maxTurns: number; replyDeadlineMs: number };
export type ConversationDeps = { provider: AiProvider; config: ConversationConfig };

export { startSession };

async function answer(
  { provider, config }: ConversationDeps,
  userId: string,
  turn: TurnResult,
): Promise<TurnResult> {
  const sessionId = turn.session.id;
  let reply: string | null = null;
  try {
    const input = await getReplyInput(userId, sessionId, turn.message);
    const output = await provider.reply(input, {
      signal: AbortSignal.timeout(config.replyDeadlineMs),
    });
    const parsed = replySchema.safeParse(output);
    if (parsed.success) {
      reply = parsed.data.text;
    } else {
      // Log the schema paths only, never the output (docs/backend_schema.md §2.4).
      logger.warn("ai_reply_failed", {
        sessionId,
        messageId: turn.message.id,
        provider: provider.name,
        kind: "invalid_output",
        paths: parsed.error.issues.map((issue) => issue.path.join(".")).join(","),
      });
    }
  } catch (error) {
    const kind =
      error instanceof AiProviderError
        ? error.kind
        : error instanceof DOMException && error.name === "TimeoutError"
          ? "timeout"
          : "internal";
    logger.warn("ai_reply_failed", {
      sessionId,
      messageId: turn.message.id,
      provider: provider.name,
      kind,
    });
  }
  // Always settle the pending message, so it never stays stuck.
  return finishUserTurn(userId, turn.message.id, reply);
}

/**
 * POST /api/sessions/:id/messages. A repeated clientMessageId returns the
 * stored result without a provider call. The returned message is "ok" with a
 * reply, or "reply_failed" (saved; the learner can retry).
 */
export async function sendMessage(
  deps: ConversationDeps,
  input: { userId: string; sessionId: string; clientMessageId: string; content: string },
): Promise<TurnResult> {
  const turn = await beginUserTurn(input.userId, input.sessionId, {
    clientMessageId: input.clientMessageId,
    content: input.content,
    maxTurns: deps.config.maxTurns,
    staleMs: staleAfterMs(deps.config.replyDeadlineMs),
  });
  if (turn.outcome === "duplicate") return turn;
  return answer(deps, input.userId, turn);
}

/** POST /api/sessions/:id/messages/:messageId/retry (reply_failed messages only). */
export async function retryMessage(
  deps: ConversationDeps,
  input: { userId: string; sessionId: string; messageId: string },
): Promise<TurnResult> {
  const turn = await beginRetry(
    input.userId,
    input.sessionId,
    input.messageId,
    staleAfterMs(deps.config.replyDeadlineMs),
  );
  if (turn.outcome === "duplicate") return turn;
  return answer(deps, input.userId, turn);
}

/** POST /api/sessions/:id/complete. Idempotent; feedback arrives in M7. */
export function complete(
  config: ConversationConfig,
  input: { userId: string; sessionId: string },
): Promise<SessionState> {
  return completeSession(input.userId, input.sessionId, staleAfterMs(config.replyDeadlineMs));
}
