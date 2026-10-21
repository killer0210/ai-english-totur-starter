import type { ErrorCode } from "@/lib/errors";

import type { MessageStatus, MessageView, SessionState, SessionStatus, TurnResult } from "./types";

// Client-side state of /talk (docs/design_system.md Composer, MessageBubble).
// Pure, so every transition is unit-tested; the server stays the source of
// truth and each response replaces the local copy.

/** "sending" exists only in the browser, before the server has answered. */
export type ClientMessage = Omit<MessageView, "status"> & { status: MessageStatus | "sending" };

export type ConversationState = {
  session: Pick<SessionState, "status" | "learnerTurnCount" | "feedbackStatus">;
  messages: ClientMessage[];
  request: "idle" | "sending" | "retrying" | "completing";
  /** The server refused for a reason the local state did not predict. */
  blocked: boolean;
  /** The server answered TURN_LIMIT_REACHED. */
  turnLimitReached: boolean;
};

export type ComposerState =
  "idle" | "sending" | "pending" | "reply_failed" | "blocked" | "turn_limit" | "completed";

export type ConversationAction =
  | { type: "send"; clientMessageId: string; content: string; now: string }
  | { type: "turn"; result: TurnResult }
  | { type: "send_rejected"; clientMessageId: string; code: ErrorCode | null }
  | { type: "retry"; messageId: string }
  | { type: "retry_rejected"; messageId: string; code: ErrorCode | null }
  | { type: "complete" }
  | { type: "completed"; session: SessionState }
  | { type: "complete_rejected"; code: ErrorCode | null };

const localId = (clientMessageId: string) => `local-${clientMessageId}`;

function upsert(messages: ClientMessage[], message: MessageView): ClientMessage[] {
  const index = messages.findIndex(
    (m) =>
      m.id === message.id ||
      (message.clientMessageId !== null && m.id === localId(message.clientMessageId)),
  );
  if (index === -1) return [...messages, message];
  return messages.with(index, message);
}

function sessionFrom(
  state: ConversationState,
  session: SessionState,
): ConversationState["session"] {
  return {
    ...state.session,
    status: session.status,
    learnerTurnCount: session.learnerTurnCount,
    feedbackStatus: session.feedbackStatus,
  };
}

/** Refusals that mean the session is no longer open for writing. */
function closedStatus(code: ErrorCode | null): SessionStatus | null {
  return code === "SESSION_NOT_ACTIVE" ? "completed" : null;
}

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case "send":
      return {
        ...state,
        request: "sending",
        messages: [
          ...state.messages,
          {
            id: localId(action.clientMessageId),
            seq: Number.MAX_SAFE_INTEGER,
            role: "user",
            content: action.content,
            status: "sending",
            clientMessageId: action.clientMessageId,
            replyToMessageId: null,
            createdAt: action.now,
          },
        ],
      };

    case "turn": {
      let messages = upsert(state.messages, action.result.message);
      if (action.result.reply) messages = upsert(messages, action.result.reply);
      return {
        ...state,
        request: "idle",
        blocked: false,
        session: sessionFrom(state, action.result.session),
        messages: messages.toSorted((a, b) => a.seq - b.seq),
      };
    }

    case "send_rejected": {
      // Nothing was saved (or the network failed before an answer): drop the
      // local bubble; the draft stays in the Composer for another try.
      const messages = state.messages.filter((m) => m.id !== localId(action.clientMessageId));
      const status = closedStatus(action.code);
      return {
        ...state,
        request: "idle",
        messages,
        blocked: action.code === "MESSAGE_BLOCKED" || action.code === "IN_PROGRESS",
        turnLimitReached: state.turnLimitReached || action.code === "TURN_LIMIT_REACHED",
        session: status ? { ...state.session, status } : state.session,
      };
    }

    case "retry":
      return {
        ...state,
        request: "retrying",
        messages: state.messages.map((m) =>
          m.id === action.messageId ? { ...m, status: "pending" } : m,
        ),
      };

    case "retry_rejected": {
      const status = closedStatus(action.code);
      return {
        ...state,
        request: "idle",
        blocked: action.code === "IN_PROGRESS",
        messages: state.messages.map((m) =>
          m.id === action.messageId && action.code !== "IN_PROGRESS"
            ? { ...m, status: "reply_failed" }
            : m,
        ),
        session: status ? { ...state.session, status } : state.session,
      };
    }

    case "complete":
      return { ...state, request: "completing" };

    case "completed":
      return { ...state, request: "idle", session: sessionFrom(state, action.session) };

    case "complete_rejected": {
      const status = closedStatus(action.code);
      return {
        ...state,
        request: "idle",
        blocked: action.code === "IN_PROGRESS",
        session: status ? { ...state.session, status } : state.session,
      };
    }
  }
}

export function composerState(state: ConversationState, maxTurns: number): ComposerState {
  if (state.session.status !== "active") return "completed";
  if (state.request === "sending" || state.request === "completing") return "sending";
  const learner = state.messages.filter((m) => m.role === "user");
  if (state.request === "retrying" || learner.some((m) => m.status === "pending")) {
    return "pending";
  }
  if (learner.some((m) => m.status === "reply_failed")) return "reply_failed";
  if (state.blocked) return "blocked";
  if (state.turnLimitReached || state.session.learnerTurnCount >= maxTurns) return "turn_limit";
  return "idle";
}

/** Learner messages so far; fewer than 3 → the "no feedback" warning on complete. */
export function learnerMessageCount(state: ConversationState): number {
  return state.messages.filter((m) => m.role === "user" && m.status !== "sending").length;
}

export const MIN_MESSAGES_FOR_FEEDBACK = 3;
