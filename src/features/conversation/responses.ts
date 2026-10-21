import { NextResponse } from "next/server";

import type { ErrorBody } from "@/lib/errors";

import messages from "../../../messages/mn.json";

import type { TurnResult } from "./types";

/**
 * Response for a send or retry. "ok" → 200 with the reply. "reply_failed" →
 * 503 AI_UNAVAILABLE (retryable) that still carries the saved learner message,
 * so the client can say honestly that it was saved (docs/prd.md FR-10).
 */
export function turnResponse(result: TurnResult): NextResponse {
  if (result.message.status === "reply_failed") {
    const body: ErrorBody & Omit<TurnResult, "reply"> = {
      error: { code: "AI_UNAVAILABLE", message_mn: messages.talk.replyFailed, retryable: true },
      session: result.session,
      message: result.message,
    };
    return NextResponse.json(body, { status: 503 });
  }
  return NextResponse.json(result);
}
