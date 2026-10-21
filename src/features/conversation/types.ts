import type { EnglishLevel } from "@/features/profile/schemas";

export type MessageStatus = "pending" | "ok" | "reply_failed";
export type SessionStatus = "active" | "completed" | "abandoned";
export type FeedbackStatus = "none" | "skipped" | "pending" | "ready" | "failed";

export type MessageView = {
  id: string;
  seq: number;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  clientMessageId: string | null;
  replyToMessageId: string | null;
  createdAt: string;
};

export type SessionState = {
  id: string;
  status: SessionStatus;
  learnerTurnCount: number;
  feedbackStatus: FeedbackStatus;
  lastActivityAt: string;
  completedAt: string | null;
};

export type ConversationView = {
  session: SessionState & {
    scenario: { id: string; titleMn: string; introEn: string; englishLevel: EnglishLevel } | null;
    maxTurns: number;
  };
  /** Oldest first. */
  messages: MessageView[];
  /** seq to pass as ?before= for the previous page, or null on the first message. */
  previousCursor: number | null;
};

export type SessionListItem = {
  id: string;
  status: SessionStatus;
  scenarioTitleMn: string | null;
  learnerTurnCount: number;
  startedAt: string;
  lastActivityAt: string;
};

/** Result of a send or retry: the learner message and, when ok, the reply. */
export type TurnResult = {
  session: SessionState;
  message: MessageView;
  reply: MessageView | null;
};
