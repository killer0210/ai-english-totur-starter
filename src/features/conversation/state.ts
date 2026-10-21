import type { MessageStatus, SessionStatus } from "./types";

// Lazy expiry rules (docs/backend_schema.md §2.3, ADR-003). The DB functions
// persist them on the next write; reads apply them here so the UI never shows
// a stuck "pending" or an "active" session that has been idle for a day.

export const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

/** A pending message counts as reply_failed after twice the reply deadline. */
export function staleAfterMs(replyDeadlineMs: number): number {
  return replyDeadlineMs * 2;
}

export function effectiveMessageStatus(
  message: { status: MessageStatus; updatedAt: string },
  now: Date,
  staleMs: number,
): MessageStatus {
  if (message.status !== "pending") return message.status;
  const age = now.getTime() - new Date(message.updatedAt).getTime();
  return age > staleMs ? "reply_failed" : "pending";
}

export function effectiveSessionStatus(
  session: { status: SessionStatus; lastActivityAt: string },
  now: Date,
): SessionStatus {
  if (session.status !== "active") return session.status;
  const idle = now.getTime() - new Date(session.lastActivityAt).getTime();
  return idle > ABANDON_AFTER_MS ? "abandoned" : "active";
}
