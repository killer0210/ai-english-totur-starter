import type { SupabaseClient } from "@supabase/supabase-js";

import type { EnglishLevel } from "@/features/profile/schemas";
import type { ChatTurn, ReplyInput } from "@/lib/ai/adapter";
import { AppError, defaultMessageMn, type ErrorCode } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

import { effectiveMessageStatus, effectiveSessionStatus } from "./state";
import type {
  ConversationView,
  FeedbackStatus,
  MessageStatus,
  MessageView,
  SessionListItem,
  SessionState,
  SessionStatus,
  TurnResult,
} from "./types";

// Writes: the DB functions of supabase/migrations/20261022090000_conversation.sql
// through the service-role client (ADR-005). Reads: the user-session client,
// so RLS returns only the user's own rows (ADR-004).

/** Messages sent to the provider as context (docs/trd.md §3.1, default 12). */
export const CONTEXT_MESSAGES = 12;

type MessageJson = {
  id: string;
  seq: number;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  client_message_id: string | null;
  reply_to_message_id: string | null;
  created_at: string;
};

type SessionJson = {
  id: string;
  status: SessionStatus;
  learner_turn_count: number;
  feedback_status: FeedbackStatus;
  last_activity_at: string;
  completed_at: string | null;
};

type FunctionResult = {
  error?: ErrorCode;
  outcome?: string;
  session?: SessionJson;
  message?: MessageJson;
  reply?: MessageJson | null;
};

const ERROR_STATUS: Partial<Record<ErrorCode, number>> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SESSION_NOT_ACTIVE: 409,
  MESSAGE_BLOCKED: 409,
  IN_PROGRESS: 409,
  TURN_LIMIT_REACHED: 409,
};

function internalError(): AppError {
  return new AppError("INTERNAL", defaultMessageMn("INTERNAL"), 500);
}

function refused(code: ErrorCode): AppError {
  const status = ERROR_STATUS[code];
  if (!status) {
    logger.error("conversation_unknown_refusal", { code });
    return internalError();
  }
  // IN_PROGRESS: the reply is still coming; the client may ask again.
  return new AppError(code, defaultMessageMn(code), status, code === "IN_PROGRESS");
}

function toMessage(row: MessageJson): MessageView {
  return {
    id: row.id,
    seq: Number(row.seq),
    role: row.role,
    content: row.content,
    status: row.status,
    clientMessageId: row.client_message_id,
    replyToMessageId: row.reply_to_message_id,
    createdAt: row.created_at,
  };
}

function toSession(row: SessionJson): SessionState {
  return {
    id: row.id,
    status: row.status,
    learnerTurnCount: row.learner_turn_count,
    feedbackStatus: row.feedback_status,
    lastActivityAt: row.last_activity_at,
    completedAt: row.completed_at,
  };
}

async function callFunction(
  name: string,
  args: Record<string, unknown>,
  meta: { userId: string; sessionId?: string },
): Promise<FunctionResult> {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) {
    logger.error("conversation_write_failed", { fn: name, ...meta, code: error.code });
    throw internalError();
  }
  const result = data as FunctionResult;
  if (result.error) throw refused(result.error);
  return result;
}

function toTurn(result: FunctionResult): TurnResult {
  if (!result.session || !result.message) throw internalError();
  return {
    session: toSession(result.session),
    message: toMessage(result.message),
    reply: result.reply ? toMessage(result.reply) : null,
  };
}

export async function startSession(userId: string, scenarioId: string): Promise<SessionState> {
  const result = await callFunction(
    "start_session",
    { p_user_id: userId, p_scenario_id: scenarioId },
    { userId },
  );
  if (!result.session) throw internalError();
  return toSession(result.session);
}

/** "created": a new pending message to answer; "duplicate": the stored result. */
export async function beginUserTurn(
  userId: string,
  sessionId: string,
  input: { clientMessageId: string; content: string; maxTurns: number; staleMs: number },
): Promise<{ outcome: "created" | "duplicate" } & TurnResult> {
  const result = await callFunction(
    "begin_user_turn",
    {
      p_user_id: userId,
      p_session_id: sessionId,
      p_client_message_id: input.clientMessageId,
      p_content: input.content,
      p_max_turns: input.maxTurns,
      p_stale_ms: input.staleMs,
    },
    { userId, sessionId },
  );
  return { outcome: result.outcome === "created" ? "created" : "duplicate", ...toTurn(result) };
}

/** "retrying": the message is pending again; "duplicate": it already has a reply. */
export async function beginRetry(
  userId: string,
  sessionId: string,
  messageId: string,
  staleMs: number,
): Promise<{ outcome: "retrying" | "duplicate" } & TurnResult> {
  const result = await callFunction(
    "begin_retry",
    { p_user_id: userId, p_session_id: sessionId, p_message_id: messageId, p_stale_ms: staleMs },
    { userId, sessionId },
  );
  return { outcome: result.outcome === "retrying" ? "retrying" : "duplicate", ...toTurn(result) };
}

/** Stores the reply, or marks the message reply_failed when `reply` is null. */
export async function finishUserTurn(
  userId: string,
  messageId: string,
  reply: string | null,
): Promise<TurnResult> {
  const result = await callFunction(
    "finish_user_turn",
    { p_user_id: userId, p_message_id: messageId, p_reply: reply },
    { userId },
  );
  return toTurn(result);
}

export async function completeSession(
  userId: string,
  sessionId: string,
  staleMs: number,
): Promise<SessionState> {
  const result = await callFunction(
    "complete_session",
    { p_user_id: userId, p_session_id: sessionId, p_stale_ms: staleMs },
    { userId, sessionId },
  );
  if (!result.session) throw internalError();
  return toSession(result.session);
}

type ContextSessionRow = {
  english_level_at_start: EnglishLevel;
  scenarios: { ai_role: string; user_role: string; role_context: string; intro_en: string };
};

/**
 * Provider input for one learner message: the scenario and the last
 * CONTEXT_MESSAGES messages up to and including it. Server-side read, scoped
 * to the verified user id.
 */
export async function getReplyInput(
  userId: string,
  sessionId: string,
  message: MessageView,
): Promise<ReplyInput> {
  const admin = createAdminClient();
  const [session, history] = await Promise.all([
    admin
      .from("practice_sessions")
      .select("english_level_at_start, scenarios(ai_role, user_role, role_context, intro_en)")
      .eq("user_id", userId)
      .eq("id", sessionId)
      .single<ContextSessionRow>(),
    admin
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .lte("seq", message.seq)
      .order("seq", { ascending: false })
      .limit(CONTEXT_MESSAGES)
      .returns<ChatTurn[]>(),
  ]);
  if (session.error || history.error) {
    logger.error("conversation_context_failed", {
      userId,
      sessionId,
      code: session.error?.code ?? history.error?.code,
    });
    throw internalError();
  }
  const scenario = session.data.scenarios;
  return {
    messageId: message.id,
    englishLevel: session.data.english_level_at_start,
    scenario: {
      aiRole: scenario.ai_role,
      userRole: scenario.user_role,
      roleContext: scenario.role_context,
      introEn: scenario.intro_en,
    },
    history: history.data.toReversed(),
  };
}

type SessionRow = SessionJson & {
  scenario_id: string;
  scenarios: {
    id: string;
    title_mn: string;
    intro_en: string;
    english_level: EnglishLevel;
  } | null;
};

type MessageRow = MessageJson & { updated_at: string };

/**
 * One conversation for /talk and GET /api/sessions/:id: the session and a page
 * of messages (the newest `limit`, or those before `before`), oldest first.
 * Returns null when the session does not exist or is not the user's.
 */
export async function getConversation(
  supabase: SupabaseClient,
  sessionId: string,
  options: { before?: number; limit: number; maxTurns: number; staleMs: number; now?: Date },
): Promise<ConversationView | null> {
  const now = options.now ?? new Date();
  const { data: session, error } = await supabase
    .from("practice_sessions")
    .select(
      "id, status, learner_turn_count, feedback_status, last_activity_at, completed_at, scenario_id, scenarios(id, title_mn, intro_en, english_level)",
    )
    .eq("id", sessionId)
    .maybeSingle<SessionRow>();
  if (error) {
    logger.error("conversation_read_failed", { sessionId, code: error.code });
    throw internalError();
  }
  if (!session) return null;

  let query = supabase
    .from("messages")
    .select(
      "id, seq, role, content, status, client_message_id, reply_to_message_id, created_at, updated_at",
    )
    .eq("session_id", sessionId)
    .order("seq", { ascending: false })
    .limit(options.limit + 1);
  if (options.before !== undefined) query = query.lt("seq", options.before);
  const { data: rows, error: messagesError } = await query.returns<MessageRow[]>();
  if (messagesError) {
    logger.error("conversation_read_failed", { sessionId, code: messagesError.code });
    throw internalError();
  }

  const hasMore = rows.length > options.limit;
  const page = rows.slice(0, options.limit).toReversed();
  const messages = page.map((row) => ({
    ...toMessage(row),
    status: effectiveMessageStatus(
      { status: row.status, updatedAt: row.updated_at },
      now,
      options.staleMs,
    ),
  }));

  return {
    session: {
      ...toSession(session),
      status: effectiveSessionStatus(
        { status: session.status, lastActivityAt: session.last_activity_at },
        now,
      ),
      scenario: session.scenarios
        ? {
            id: session.scenarios.id,
            titleMn: session.scenarios.title_mn,
            introEn: session.scenarios.intro_en,
            englishLevel: session.scenarios.english_level,
          }
        : null,
      maxTurns: options.maxTurns,
    },
    messages,
    previousCursor: hasMore && messages[0] ? messages[0].seq : null,
  };
}

type ListRow = {
  id: string;
  status: SessionStatus;
  learner_turn_count: number;
  started_at: string;
  last_activity_at: string;
  scenarios: { title_mn: string } | null;
};

/** Cursor for the next page of the history list: "<last_activity_at>|<id>". */
export type SessionsCursor = { lastActivityAt: string; id: string };

export function encodeSessionsCursor(cursor: SessionsCursor): string {
  return `${cursor.lastActivityAt}|${cursor.id}`;
}

export function decodeSessionsCursor(value: string | null | undefined): SessionsCursor | null {
  if (!value) return null;
  const [lastActivityAt, id, ...rest] = value.split("|");
  if (!lastActivityAt || !id || rest.length > 0) return null;
  if (Number.isNaN(Date.parse(lastActivityAt))) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { lastActivityAt, id };
}

/** The user's conversations, most recent activity first (keyset pagination). */
export async function listSessions(
  supabase: SupabaseClient,
  options: { cursor: SessionsCursor | null; limit: number; now?: Date },
): Promise<{ sessions: SessionListItem[]; nextCursor: string | null }> {
  const now = options.now ?? new Date();
  let query = supabase
    .from("practice_sessions")
    .select("id, status, learner_turn_count, started_at, last_activity_at, scenarios(title_mn)")
    .order("last_activity_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(options.limit + 1);
  if (options.cursor) {
    const { lastActivityAt, id } = options.cursor;
    query = query.or(
      `last_activity_at.lt."${lastActivityAt}",and(last_activity_at.eq."${lastActivityAt}",id.lt.${id})`,
    );
  }
  const { data, error } = await query.returns<ListRow[]>();
  if (error) {
    logger.error("sessions_list_failed", { code: error.code });
    throw internalError();
  }
  const page = data.slice(0, options.limit);
  const last = page.at(-1);
  return {
    sessions: page.map((row) => ({
      id: row.id,
      status: effectiveSessionStatus(
        { status: row.status, lastActivityAt: row.last_activity_at },
        now,
      ),
      scenarioTitleMn: row.scenarios?.title_mn ?? null,
      learnerTurnCount: row.learner_turn_count,
      startedAt: row.started_at,
      lastActivityAt: row.last_activity_at,
    })),
    nextCursor:
      data.length > options.limit && last
        ? encodeSessionsCursor({ lastActivityAt: last.last_activity_at, id: last.id })
        : null,
  };
}

/** Scenarios with at least one completed conversation ("done" on /path). */
export async function getCompletedScenarioIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("practice_sessions")
    .select("scenario_id")
    .eq("status", "completed")
    .returns<{ scenario_id: string }[]>();
  if (error) {
    logger.error("completed_scenarios_read_failed", { code: error.code });
    throw internalError();
  }
  return new Set(data.map((row) => row.scenario_id));
}
