import "server-only";

import { getAiProvider } from "@/lib/ai/provider";
import { getServerEnv } from "@/lib/env";

import type { ConversationConfig, ConversationDeps } from "./service";
import { staleAfterMs } from "./state";

export function conversationConfig(): ConversationConfig & { staleMs: number } {
  const env = getServerEnv();
  return {
    maxTurns: env.CONVERSATION_MAX_TURNS,
    replyDeadlineMs: env.AI_REPLY_DEADLINE_MS,
    staleMs: staleAfterMs(env.AI_REPLY_DEADLINE_MS),
  };
}

export function conversationDeps(): ConversationDeps {
  return { provider: getAiProvider(), config: conversationConfig() };
}
