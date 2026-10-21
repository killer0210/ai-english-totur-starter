import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as completeRoute } from "@/app/api/sessions/[id]/complete/route";
import { POST as retryRoute } from "@/app/api/sessions/[id]/messages/[messageId]/retry/route";
import { POST as messagesRoute } from "@/app/api/sessions/[id]/messages/route";
import { GET as sessionRoute } from "@/app/api/sessions/[id]/route";
import { GET as listRoute, POST as startRoute } from "@/app/api/sessions/route";
import { getAiProvider } from "@/lib/ai/provider";
import type { MockProvider } from "@/lib/ai/providers/mock";

import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  env,
  jsonRequest,
  sessionCookie,
  signedInClient,
} from "./support/supabase";

// M5 conversation against the local stack with the mock provider
// (docs/testing.md §3 #1–6, #8–10, #12). Route handlers are called directly.

type User = Awaited<ReturnType<typeof createUser>> & { cookie: string };

const created: string[] = [];
let a: User;
let b: User;
let scenarioId: string;
const mock = () => getAiProvider() as MockProvider;

async function newUser(label: string, onboarded = true): Promise<User> {
  const user = await createUser(label);
  created.push(user.id);
  if (onboarded) {
    const now = new Date().toISOString();
    const { error } = await adminClient()
      .from("profiles")
      .update({ age_confirmed_at: now, onboarding_completed_at: now, english_level: "A1" })
      .eq("id", user.id);
    if (error) throw error;
  }
  return { ...user, cookie: await sessionCookie(user.email, user.password) };
}

const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

function getRequest(path: string, cookie?: string) {
  return new NextRequest(new URL(path, env.siteUrl()), {
    headers: cookie ? { cookie } : {},
  });
}

async function start(user: User | null, body: unknown = { scenarioId }) {
  const response = await startRoute(
    jsonRequest("/api/sessions", body, user ? { cookie: user.cookie } : {}),
  );
  return { response, body: await response.json() };
}

async function newSession(user: User): Promise<string> {
  const { response, body } = await start(user);
  expect(response.status).toBe(201);
  return body.session.id as string;
}

async function send(
  user: User,
  sessionId: string,
  content: string,
  clientMessageId = randomUUID(),
) {
  const response = await messagesRoute(
    jsonRequest(
      `/api/sessions/${sessionId}/messages`,
      { clientMessageId, content },
      {
        cookie: user.cookie,
      },
    ),
    ctx({ id: sessionId }),
  );
  return { status: response.status, body: await response.json(), clientMessageId };
}

async function retry(user: User, sessionId: string, messageId: string) {
  const response = await retryRoute(
    jsonRequest(
      `/api/sessions/${sessionId}/messages/${messageId}/retry`,
      {},
      {
        cookie: user.cookie,
      },
    ),
    ctx({ id: sessionId, messageId }),
  );
  return { status: response.status, body: await response.json() };
}

async function complete(user: User, sessionId: string) {
  const response = await completeRoute(
    jsonRequest(`/api/sessions/${sessionId}/complete`, {}, { cookie: user.cookie }),
    ctx({ id: sessionId }),
  );
  return { status: response.status, body: await response.json() };
}

async function view(user: User | null, sessionId: string, query = "") {
  const response = await sessionRoute(
    getRequest(`/api/sessions/${sessionId}${query}`, user?.cookie),
    ctx({ id: sessionId }),
  );
  return { status: response.status, body: await response.json() };
}

async function dbMessages(sessionId: string) {
  const { data, error } = await adminClient()
    .from("messages")
    .select("id, role, status, content, client_message_id, reply_to_message_id")
    .eq("session_id", sessionId)
    .order("seq");
  if (error) throw error;
  return data;
}

async function waitForPending(sessionId: string) {
  for (let i = 0; i < 50; i += 1) {
    const rows = await dbMessages(sessionId);
    if (rows.some((m) => m.status === "pending")) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("no pending message appeared");
}

beforeAll(async () => {
  a = await newUser("conv-a");
  b = await newUser("conv-b");
  const { data, error } = await adminClient()
    .from("scenarios")
    .select("id")
    .eq("slug", "introduce-yourself")
    .single();
  if (error) throw error;
  scenarioId = data.id;
});

afterAll(async () => {
  await Promise.all(created.map(deleteUser));
});

describe("POST /api/sessions", () => {
  it("returns 401 without a session and 403 for a foreign Origin", async () => {
    expect((await start(null)).response.status).toBe(401);
    const response = await startRoute(
      jsonRequest(
        "/api/sessions",
        { scenarioId },
        { cookie: a.cookie, origin: "https://evil.example" },
      ),
    );
    expect(response.status).toBe(403);
  });

  it("starts a session with the level snapshot", async () => {
    const { response, body } = await start(a);
    expect(response.status).toBe(201);
    expect(body.session).toMatchObject({
      status: "active",
      learnerTurnCount: 0,
      feedbackStatus: "none",
    });
    const { data } = await adminClient()
      .from("practice_sessions")
      .select("user_id, scenario_id, english_level_at_start")
      .eq("id", body.session.id)
      .single();
    expect(data).toEqual({ user_id: a.id, scenario_id: scenarioId, english_level_at_start: "A1" });
  });

  it("rejects an unknown scenario (404), a bad body (400) and a user who has not onboarded (403)", async () => {
    expect((await start(a, { scenarioId: randomUUID() })).response.status).toBe(404);
    expect((await start(a, { scenarioId: "cafe" })).response.status).toBe(400);
    const fresh = await newUser("conv-fresh", false);
    const { response, body } = await start(fresh);
    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});

describe("POST /api/sessions/:id/messages", () => {
  it("stores the learner message and the reply, in order", async () => {
    const sessionId = await newSession(a);
    const first = await send(a, sessionId, "Hi, I am Bat.");
    expect(first.status).toBe(200);
    expect(first.body.message).toMatchObject({
      role: "user",
      status: "ok",
      content: "Hi, I am Bat.",
    });
    expect(first.body.reply).toMatchObject({ role: "assistant", status: "ok" });
    expect(first.body.reply.content).toMatch(/^Mock reply 1/);
    expect(first.body.session.learnerTurnCount).toBe(1);

    const second = await send(a, sessionId, "I like music.");
    expect(second.body.reply.content).toMatch(/^Mock reply 2/);
    const rows = await dbMessages(sessionId);
    expect(rows.map((m) => [m.role, m.status])).toEqual([
      ["user", "ok"],
      ["assistant", "ok"],
      ["user", "ok"],
      ["assistant", "ok"],
    ]);
    expect(rows[1]!.reply_to_message_id).toBe(rows[0]!.id);
  });

  it("rejects an empty or too long message (#1, #2) without storing anything", async () => {
    const sessionId = await newSession(a);
    expect((await send(a, sessionId, "   ")).status).toBe(400);
    expect((await send(a, sessionId, "a".repeat(1001))).status).toBe(400);
    expect(await dbMessages(sessionId)).toEqual([]);
  });

  it("the same clientMessageId sent twice at once → one message and one provider call (#9)", async () => {
    const sessionId = await newSession(a);
    const clientMessageId = randomUUID();
    const content = "[mock:slow] Hello there";
    const [x, y] = await Promise.all([
      send(a, sessionId, content, clientMessageId),
      send(a, sessionId, content, clientMessageId),
    ]);
    // One request answers; the other sees it in progress (or, if late, the stored reply).
    expect([x.status, y.status].toSorted()).toEqual(
      [x, y].some((r) => r.status === 409) ? [200, 409] : [200, 200],
    );
    const conflict = [x, y].find((r) => r.status === 409);
    if (conflict)
      expect(conflict.body.error).toMatchObject({ code: "IN_PROGRESS", retryable: true });

    const rows = await dbMessages(sessionId);
    expect(rows.filter((m) => m.role === "user")).toHaveLength(1);
    expect(rows.filter((m) => m.role === "assistant")).toHaveLength(1);
    expect(mock().callCount(rows[0]!.id)).toBe(1);

    // A later repeat returns the stored reply, still without a provider call.
    const again = await send(a, sessionId, content, clientMessageId);
    expect(again.status).toBe(200);
    expect(again.body.reply.id).toBe(rows[1]!.id);
    expect(mock().callCount(rows[0]!.id)).toBe(1);
    expect((await view(a, sessionId)).body.session.learnerTurnCount).toBe(1);
  });

  it("a new message while one is pending → MESSAGE_BLOCKED (#10)", async () => {
    const sessionId = await newSession(a);
    const slow = send(a, sessionId, "[mock:slow] First");
    await waitForPending(sessionId);
    const blocked = await send(a, sessionId, "Second");
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("MESSAGE_BLOCKED");
    expect((await slow).status).toBe(200);
    expect((await dbMessages(sessionId)).filter((m) => m.role === "user")).toHaveLength(1);
  });

  it("a provider failure saves the message as reply_failed; Retry then answers it (#8)", async () => {
    const sessionId = await newSession(a);
    const failed = await send(a, sessionId, "[mock:fail-once] Where is the station?");
    expect(failed.status).toBe(503);
    expect(failed.body.error).toMatchObject({ code: "AI_UNAVAILABLE", retryable: true });
    expect(failed.body.error.message_mn).toBe("Таны мессеж хадгалагдсан. Хариу ирсэнгүй.");
    expect(failed.body.message.status).toBe("reply_failed");
    const messageId = failed.body.message.id as string;

    // Blocked until the failed message is retried (#10); a repeat of the failed
    // send is answered from the database, without a provider call.
    expect((await send(a, sessionId, "Something else")).body.error.code).toBe("MESSAGE_BLOCKED");
    const repeat = await send(
      a,
      sessionId,
      "[mock:fail-once] Where is the station?",
      failed.clientMessageId,
    );
    expect(repeat.status).toBe(503);
    expect(mock().callCount(messageId)).toBe(1);

    const retried = await retry(a, sessionId, messageId);
    expect(retried.status).toBe(200);
    expect(retried.body.message).toMatchObject({ id: messageId, status: "ok" });
    expect(retried.body.reply.reply_to_message_id ?? retried.body.reply.replyToMessageId).toBe(
      messageId,
    );
    expect(mock().callCount(messageId)).toBe(2);

    // Retrying an answered message returns the stored reply (no third call).
    expect((await retry(a, sessionId, messageId)).status).toBe(200);
    expect(mock().callCount(messageId)).toBe(2);
    // A retry is not a new turn.
    expect((await view(a, sessionId)).body.session.learnerTurnCount).toBe(1);
    expect((await send(a, sessionId, "Thanks!")).status).toBe(200);
  });

  it("timeouts and invalid output are recoverable reply_failed errors (#8)", async () => {
    for (const marker of ["[mock:timeout]", "[mock:invalid]", "[mock:error]"]) {
      const sessionId = await newSession(a);
      const result = await send(a, sessionId, `${marker} Hello`);
      expect(result.status).toBe(503);
      expect(result.body.message.status).toBe("reply_failed");
      expect(JSON.stringify(result.body)).not.toMatch(/AiProviderError|provider_error|stack/);
    }
  });

  it("a stale pending message expires to reply_failed on read and on the next write (#8)", async () => {
    const sessionId = await newSession(a);
    await send(a, sessionId, "Hello");
    // Simulate a function that died after begin_user_turn: pending, last
    // touched long ago (set on insert; the updated_at trigger runs on update).
    const { data: pending, error } = await adminClient()
      .from("messages")
      .insert({
        session_id: sessionId,
        user_id: a.id,
        role: "user",
        content: "Lost reply",
        status: "pending",
        client_message_id: randomUUID(),
        updated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    const read = await view(a, sessionId);
    expect(read.body.messages.at(-1)).toMatchObject({ id: pending.id, status: "reply_failed" });

    const blocked = await send(a, sessionId, "Next");
    expect(blocked.body.error.code).toBe("MESSAGE_BLOCKED");
    const stored = await dbMessages(sessionId);
    expect(stored.find((m) => m.id === pending.id)!.status).toBe("reply_failed");

    expect((await retry(a, sessionId, pending.id)).status).toBe(200);
  });

  it("refuses the 21st message (TURN_LIMIT_REACHED, #12)", async () => {
    const sessionId = await newSession(a);
    await adminClient()
      .from("practice_sessions")
      .update({ learner_turn_count: 20 })
      .eq("id", sessionId);
    const result = await send(a, sessionId, "One more");
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("TURN_LIMIT_REACHED");
    expect(await dbMessages(sessionId)).toEqual([]);
  });

  it("abandons a session idle for more than 24 hours", async () => {
    const sessionId = await newSession(a);
    await adminClient()
      .from("practice_sessions")
      .update({ last_activity_at: new Date(Date.now() - 25 * 3600_000).toISOString() })
      .eq("id", sessionId);
    expect((await view(a, sessionId)).body.session.status).toBe("abandoned");
    const result = await send(a, sessionId, "Hello?");
    expect(result.body.error.code).toBe("SESSION_NOT_ACTIVE");
    const { data } = await adminClient()
      .from("practice_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();
    expect(data!.status).toBe("abandoned");
  });
});

describe("POST /api/sessions/:id/complete", () => {
  it("is idempotent, skips feedback under 3 messages, and closes the session to writes (#12)", async () => {
    const sessionId = await newSession(a);
    const failed = await send(a, sessionId, "[mock:error] Hi");
    const first = await complete(a, sessionId);
    expect(first.status).toBe(200);
    expect(first.body.session).toMatchObject({ status: "completed", feedbackStatus: "skipped" });
    const second = await complete(a, sessionId);
    expect(second.status).toBe(200);
    expect(second.body.session.completedAt).toBe(first.body.session.completedAt);

    expect((await send(a, sessionId, "After the end")).body.error.code).toBe("SESSION_NOT_ACTIVE");
    expect((await retry(a, sessionId, failed.body.message.id)).body.error.code).toBe(
      "SESSION_NOT_ACTIVE",
    );
    expect((await dbMessages(sessionId)).filter((m) => m.role === "user")).toHaveLength(1);
  });

  it("keeps feedback_status 'none' with 3 or more messages, and waits for a pending reply", async () => {
    const sessionId = await newSession(a);
    for (const text of ["One.", "Two.", "Three."]) await send(a, sessionId, text);
    const slow = send(a, sessionId, "[mock:slow] Four.");
    await waitForPending(sessionId);
    expect((await complete(a, sessionId)).body.error.code).toBe("IN_PROGRESS");
    await slow;
    const done = await complete(a, sessionId);
    expect(done.body.session).toMatchObject({ status: "completed", feedbackStatus: "none" });
  });
});

describe("GET /api/sessions and /api/sessions/:id", () => {
  it("pages messages oldest first with a cursor", async () => {
    const sessionId = await newSession(a);
    for (const text of ["One.", "Two.", "Three."]) await send(a, sessionId, text);
    const page = await view(a, sessionId, "?limit=4");
    expect(page.status).toBe(200);
    expect(page.body.messages.map((m: { content: string }) => m.content.slice(0, 5))).toEqual([
      "Two.",
      "Mock ",
      "Three",
      "Mock ",
    ]);
    expect(page.body.previousCursor).toBe(page.body.messages[0].seq);
    const older = await view(a, sessionId, `?limit=4&before=${page.body.previousCursor}`);
    expect(older.body.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    expect(older.body.previousCursor).toBeNull();
    expect(page.body.session.scenario).toMatchObject({ id: scenarioId, englishLevel: "A1" });
  });

  it("lists the user's sessions, newest activity first, with a cursor", async () => {
    const response = await listRoute(getRequest("/api/sessions", a.cookie));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.sessions.length).toBeGreaterThan(5);
    const times = body.sessions.map((s: { lastActivityAt: string }) => s.lastActivityAt);
    expect(times).toEqual(times.toSorted().toReversed());
    expect(body.sessions[0].scenarioTitleMn).toBeTruthy();
    expect(body.nextCursor).toBeNull();

    const fresh = await newUser("conv-list");
    for (let i = 0; i < 21; i += 1) await newSession(fresh);
    const first = await (await listRoute(getRequest("/api/sessions", fresh.cookie))).json();
    expect(first.sessions).toHaveLength(20);
    expect(first.nextCursor).toEqual(expect.any(String));
    const next = await (
      await listRoute(
        getRequest(`/api/sessions?cursor=${encodeURIComponent(first.nextCursor)}`, fresh.cookie),
      )
    ).json();
    expect(next.sessions).toHaveLength(1);
    expect(first.sessions.map((s: { id: string }) => s.id)).not.toContain(next.sessions[0].id);
  });

  it("returns 401 without a session and 404 for an unknown id", async () => {
    expect((await listRoute(getRequest("/api/sessions"))).status).toBe(401);
    expect((await view(null, randomUUID())).status).toBe(401);
    expect((await view(a, randomUUID())).status).toBe(404);
    expect((await view(a, "not-a-uuid")).status).toBe(404);
  });
});

describe("ownership (#4–6)", () => {
  let sessionId: string;
  let messageId: string;

  beforeAll(async () => {
    sessionId = await newSession(a);
    const failed = await send(a, sessionId, "[mock:error] Private text");
    messageId = failed.body.message.id;
  });

  it("B cannot read, write, retry or complete A's session through the API", async () => {
    expect((await view(b, sessionId)).status).toBe(404);
    expect((await send(b, sessionId, "Hijack")).body.error.code).toBe("NOT_FOUND");
    expect((await retry(b, sessionId, messageId)).body.error.code).toBe("NOT_FOUND");
    expect((await complete(b, sessionId)).body.error.code).toBe("NOT_FOUND");
    // B's own session cannot be used to reach A's message either.
    const own = await newSession(b);
    expect((await retry(b, own, messageId)).body.error.code).toBe("NOT_FOUND");

    const listed = await (await listRoute(getRequest("/api/sessions", b.cookie))).json();
    expect(listed.sessions.map((s: { id: string }) => s.id)).not.toContain(sessionId);
    const after = await dbMessages(sessionId);
    expect(after.map((m) => m.content)).toEqual(["[mock:error] Private text"]);
    expect((await view(a, sessionId)).body.session.status).toBe("active");
  });

  it("B's and the anon client read none of A's rows directly", async () => {
    const client = await signedInClient(b.email, b.password);
    for (const table of ["practice_sessions", "messages"]) {
      const { data, error } = await client.from(table).select("id").eq("user_id", a.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
      const anon = await anonClient().from(table).select("id");
      expect(anon.data ?? []).toEqual([]);
    }
    const own = await (
      await signedInClient(a.email, a.password)
    )
      .from("messages")
      .select("id")
      .eq("session_id", sessionId);
    expect(own.data).toHaveLength(1);
  });

  it("an authenticated client cannot insert, update or delete sessions or messages, even its own", async () => {
    const client = await signedInClient(a.email, a.password);
    const insertSession = await client
      .from("practice_sessions")
      .insert({ user_id: a.id, scenario_id: scenarioId, english_level_at_start: "A1" });
    expect(insertSession.error).not.toBeNull();
    const insertMessage = await client.from("messages").insert({
      session_id: sessionId,
      user_id: a.id,
      role: "assistant",
      content: "x",
      status: "ok",
    });
    expect(insertMessage.error).not.toBeNull();

    const update = await client
      .from("messages")
      .update({ status: "ok" })
      .eq("id", messageId)
      .select();
    expect(update.data ?? []).toEqual([]);
    const updateSession = await client
      .from("practice_sessions")
      .update({ learner_turn_count: 0 })
      .eq("id", sessionId)
      .select();
    expect(updateSession.data ?? []).toEqual([]);
    const remove = await client.from("messages").delete().eq("id", messageId).select();
    expect(remove.data ?? []).toEqual([]);
    expect(await dbMessages(sessionId)).toHaveLength(1);
  });

  it("a message that points to another user's session fails at the DB level", async () => {
    const { error } = await adminClient().from("messages").insert({
      session_id: sessionId,
      user_id: b.id,
      role: "user",
      content: "Planted",
      status: "pending",
      client_message_id: randomUUID(),
    });
    expect(error?.code).toBe("23503");
  });

  it("authenticated and anon clients cannot EXECUTE the write functions (#5)", async () => {
    const client = await signedInClient(a.email, a.password);
    const calls: [string, Record<string, unknown>][] = [
      ["start_session", { p_user_id: a.id, p_scenario_id: scenarioId }],
      [
        "begin_user_turn",
        {
          p_user_id: a.id,
          p_session_id: sessionId,
          p_client_message_id: randomUUID(),
          p_content: "direct",
          p_max_turns: 100,
          p_stale_ms: 1,
        },
      ],
      [
        "begin_retry",
        { p_user_id: a.id, p_session_id: sessionId, p_message_id: messageId, p_stale_ms: 1 },
      ],
      ["finish_user_turn", { p_user_id: a.id, p_message_id: messageId, p_reply: "forged" }],
      ["complete_session", { p_user_id: a.id, p_session_id: sessionId, p_stale_ms: 1 }],
      ["lock_session", { p_user_id: a.id, p_session_id: sessionId, p_stale_ms: 1 }],
    ];
    for (const [fn, args] of calls) {
      for (const caller of [client, anonClient()]) {
        const { error } = await caller.rpc(fn, args);
        expect(error, fn).not.toBeNull();
        expect(error!.code, fn).toBe("42501");
      }
    }
    expect(await dbMessages(sessionId)).toHaveLength(1);
  });
});
