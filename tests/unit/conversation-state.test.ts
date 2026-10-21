import { describe, expect, it } from "vitest";

import {
  type ClientMessage,
  composerState,
  conversationReducer,
  type ConversationState,
  learnerMessageCount,
} from "@/features/conversation/conversation-state";
import {
  ABANDON_AFTER_MS,
  effectiveMessageStatus,
  effectiveSessionStatus,
  staleAfterMs,
} from "@/features/conversation/state";
import type { MessageView, SessionState, TurnResult } from "@/features/conversation/types";

const NOW = new Date("2026-10-22T10:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("lazy expiry", () => {
  const staleMs = staleAfterMs(25_000);

  it("uses twice the reply deadline", () => {
    expect(staleMs).toBe(50_000);
  });

  it("turns a pending message older than the limit into reply_failed", () => {
    expect(
      effectiveMessageStatus({ status: "pending", updatedAt: ago(10_000) }, NOW, staleMs),
    ).toBe("pending");
    expect(
      effectiveMessageStatus({ status: "pending", updatedAt: ago(50_000) }, NOW, staleMs),
    ).toBe("pending");
    expect(
      effectiveMessageStatus({ status: "pending", updatedAt: ago(50_001) }, NOW, staleMs),
    ).toBe("reply_failed");
  });

  it("never changes ok or reply_failed messages", () => {
    const old = ago(10 * 60_000);
    expect(effectiveMessageStatus({ status: "ok", updatedAt: old }, NOW, staleMs)).toBe("ok");
    expect(effectiveMessageStatus({ status: "reply_failed", updatedAt: old }, NOW, staleMs)).toBe(
      "reply_failed",
    );
  });

  it("abandons an active session idle for more than 24 hours", () => {
    expect(
      effectiveSessionStatus({ status: "active", lastActivityAt: ago(ABANDON_AFTER_MS) }, NOW),
    ).toBe("active");
    expect(
      effectiveSessionStatus({ status: "active", lastActivityAt: ago(ABANDON_AFTER_MS + 1) }, NOW),
    ).toBe("abandoned");
    expect(
      effectiveSessionStatus(
        { status: "completed", lastActivityAt: ago(ABANDON_AFTER_MS * 3) },
        NOW,
      ),
    ).toBe("completed");
  });
});

const session: SessionState = {
  id: "s1",
  status: "active",
  learnerTurnCount: 0,
  feedbackStatus: "none",
  lastActivityAt: NOW.toISOString(),
  completedAt: null,
};

function initial(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    session: { status: "active", learnerTurnCount: 0, feedbackStatus: "none" },
    messages: [],
    request: "idle",
    blocked: false,
    turnLimitReached: false,
    ...overrides,
  };
}

function message(overrides: Partial<MessageView>): MessageView {
  return {
    id: "m1",
    seq: 1,
    role: "user",
    content: "Hello",
    status: "ok",
    clientMessageId: "c1",
    replyToMessageId: null,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

function turn(status: MessageView["status"], withReply: boolean, turns = 1): TurnResult {
  return {
    session: { ...session, learnerTurnCount: turns },
    message: message({ status }),
    reply: withReply
      ? message({
          id: "r1",
          seq: 2,
          role: "assistant",
          content: "Hi!",
          clientMessageId: null,
          replyToMessageId: "m1",
        })
      : null,
  };
}

const MAX = 20;

describe("conversationReducer and composerState", () => {
  it("idle → sending (local bubble) → ok with the reply", () => {
    let state = initial();
    expect(composerState(state, MAX)).toBe("idle");

    state = conversationReducer(state, {
      type: "send",
      clientMessageId: "c1",
      content: "Hello",
      now: NOW.toISOString(),
    });
    expect(composerState(state, MAX)).toBe("sending");
    expect(state.messages).toMatchObject([{ id: "local-c1", status: "sending" }]);
    expect(learnerMessageCount(state)).toBe(0);

    state = conversationReducer(state, { type: "turn", result: turn("ok", true) });
    expect(composerState(state, MAX)).toBe("idle");
    expect(state.messages.map((m) => [m.id, m.status])).toEqual([
      ["m1", "ok"],
      ["r1", "ok"],
    ]);
    expect(state.session.learnerTurnCount).toBe(1);
    expect(learnerMessageCount(state)).toBe(1);
  });

  it("reply_failed locks the composer until a retry succeeds", () => {
    let state = conversationReducer(initial(), {
      type: "send",
      clientMessageId: "c1",
      content: "Hello",
      now: NOW.toISOString(),
    });
    state = conversationReducer(state, { type: "turn", result: turn("reply_failed", false) });
    expect(composerState(state, MAX)).toBe("reply_failed");
    expect(state.messages).toMatchObject([{ id: "m1", status: "reply_failed" }]);

    state = conversationReducer(state, { type: "retry", messageId: "m1" });
    expect(composerState(state, MAX)).toBe("pending");
    expect(state.messages[0]!.status).toBe("pending");

    state = conversationReducer(state, { type: "turn", result: turn("ok", true) });
    expect(composerState(state, MAX)).toBe("idle");
  });

  it("a rejected retry restores reply_failed", () => {
    const failed = initial({ messages: [message({ status: "reply_failed" })] });
    let state = conversationReducer(failed, { type: "retry", messageId: "m1" });
    state = conversationReducer(state, { type: "retry_rejected", messageId: "m1", code: null });
    expect(state.messages[0]!.status).toBe("reply_failed");
    expect(composerState(state, MAX)).toBe("reply_failed");
  });

  it("a rejected send removes the local bubble; MESSAGE_BLOCKED blocks the composer", () => {
    let state = conversationReducer(initial(), {
      type: "send",
      clientMessageId: "c2",
      content: "Hi",
      now: NOW.toISOString(),
    });
    state = conversationReducer(state, {
      type: "send_rejected",
      clientMessageId: "c2",
      code: "MESSAGE_BLOCKED",
    });
    expect(state.messages).toEqual([]);
    expect(composerState(state, MAX)).toBe("blocked");

    // A network failure leaves the composer usable (the draft is kept by the component).
    let offline = conversationReducer(initial(), {
      type: "send",
      clientMessageId: "c3",
      content: "Hi",
      now: NOW.toISOString(),
    });
    offline = conversationReducer(offline, {
      type: "send_rejected",
      clientMessageId: "c3",
      code: null,
    });
    expect(composerState(offline, MAX)).toBe("idle");
  });

  it("a pending message loaded from the server shows the pending state", () => {
    expect(composerState(initial({ messages: [message({ status: "pending" })] }), MAX)).toBe(
      "pending",
    );
  });

  it("reaches the turn limit from the count or from TURN_LIMIT_REACHED", () => {
    expect(
      composerState(
        initial({ session: { status: "active", learnerTurnCount: 20, feedbackStatus: "none" } }),
        MAX,
      ),
    ).toBe("turn_limit");
    let state = conversationReducer(initial(), {
      type: "send",
      clientMessageId: "c4",
      content: "Hi",
      now: NOW.toISOString(),
    });
    state = conversationReducer(state, {
      type: "send_rejected",
      clientMessageId: "c4",
      code: "TURN_LIMIT_REACHED",
    });
    expect(composerState(state, MAX)).toBe("turn_limit");
  });

  it("completing hides the composer; SESSION_NOT_ACTIVE closes it too", () => {
    let state = conversationReducer(initial(), { type: "complete" });
    expect(composerState(state, MAX)).toBe("sending");
    state = conversationReducer(state, {
      type: "completed",
      session: { ...session, status: "completed", feedbackStatus: "skipped" },
    });
    expect(composerState(state, MAX)).toBe("completed");
    expect(state.session.feedbackStatus).toBe("skipped");

    const closed = conversationReducer(initial(), {
      type: "send_rejected",
      clientMessageId: "c5",
      code: "SESSION_NOT_ACTIVE",
    });
    expect(composerState(closed, MAX)).toBe("completed");
  });

  it("keeps messages in seq order", () => {
    const messages: ClientMessage[] = [message({ id: "a", seq: 5 })];
    const state = conversationReducer(initial({ messages }), {
      type: "turn",
      result: { session, message: message({ id: "b", seq: 3, clientMessageId: "x" }), reply: null },
    });
    expect(state.messages.map((m) => m.id)).toEqual(["b", "a"]);
  });
});
