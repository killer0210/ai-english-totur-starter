import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST as confirmAgeRoute } from "@/app/api/age-confirmation/route";
import { POST as requestOtpRoute } from "@/app/api/auth/otp/route";

import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  findUserByEmail,
  jsonRequest,
  signedInClient,
  uniqueEmail,
} from "./support/supabase";

const created: string[] = [];

afterAll(async () => {
  await Promise.all(created.map(deleteUser));
});

describe("on_auth_user_created trigger", () => {
  it("creates a profile with defaults when Auth creates a user", async () => {
    const user = await createUser("trigger");
    created.push(user.id);

    const { data, error } = await adminClient()
      .from("profiles")
      .select("id, english_level, daily_minutes_goal, goals, age_confirmed_at")
      .eq("id", user.id)
      .single();

    expect(error).toBeNull();
    expect(data).toEqual({
      id: user.id,
      english_level: "A2",
      daily_minutes_goal: 10,
      goals: [],
      age_confirmed_at: null,
    });
  });
});

describe("profiles RLS (publishable key, as a browser could call it)", () => {
  let a: Awaited<ReturnType<typeof createUser>>;
  let b: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    a = await createUser("a");
    b = await createUser("b");
    created.push(a.id, b.id);
  });

  it("user A reads only their own profile", async () => {
    const client = await signedInClient(a.email, a.password);

    const all = await client.from("profiles").select("id");
    expect(all.error).toBeNull();
    expect(all.data).toEqual([{ id: a.id }]);

    const other = await client.from("profiles").select("id").eq("id", b.id);
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);
  });

  it("user A cannot update user B's profile", async () => {
    const client = await signedInClient(a.email, a.password);
    const { data } = await client
      .from("profiles")
      .update({ display_name: "hijacked" })
      .eq("id", b.id)
      .select("id");
    expect(data ?? []).toEqual([]);

    const check = await adminClient()
      .from("profiles")
      .select("display_name")
      .eq("id", b.id)
      .single();
    expect(check.data?.display_name).toBeNull();
  });

  it("an authenticated user cannot UPDATE their own profile directly", async () => {
    const client = await signedInClient(a.email, a.password);
    const { data, error } = await client
      .from("profiles")
      .update({ age_confirmed_at: new Date().toISOString() })
      .eq("id", a.id)
      .select("id");
    // Expected: permission denied (no UPDATE grant). Either way, no row may change.
    expect(error !== null || (data ?? []).length === 0).toBe(true);

    const check = await adminClient()
      .from("profiles")
      .select("age_confirmed_at")
      .eq("id", a.id)
      .single();
    expect(check.data?.age_confirmed_at).toBeNull();
  });

  it("an authenticated user cannot INSERT a profile", async () => {
    const client = await signedInClient(a.email, a.password);
    const { error } = await client.from("profiles").insert({ id: randomUUID() });
    expect(error).not.toBeNull();
  });

  it("a signed-out client reads no profiles", async () => {
    const { data } = await anonClient().from("profiles").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("client roles cannot execute the trigger functions", async () => {
    const client = await signedInClient(a.email, a.password);
    const { error } = await client.rpc("handle_new_user");
    expect(error).not.toBeNull();
  });
});

describe("POST /api/age-confirmation", () => {
  it("returns 401 without a session", async () => {
    const response = await confirmAgeRoute(
      jsonRequest("/api/age-confirmation", { confirmed: true }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 403 for a foreign Origin (CSRF)", async () => {
    const response = await confirmAgeRoute(
      jsonRequest("/api/age-confirmation", { confirmed: true }, { origin: "https://evil.example" }),
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /api/auth/otp (invite-only)", () => {
  it("answers the same for invited and non-invited emails and never creates a user", async () => {
    const invited = await createUser("invited");
    created.push(invited.id);
    const stranger = uniqueEmail("stranger");

    const forInvited = await requestOtpRoute(
      jsonRequest("/api/auth/otp", { email: invited.email }),
    );
    const forStranger = await requestOtpRoute(jsonRequest("/api/auth/otp", { email: stranger }));

    expect(forStranger.status).toBe(forInvited.status);
    expect(await forStranger.json()).toEqual(await forInvited.json());
    expect(forInvited.status).toBe(200);

    expect(await findUserByEmail(stranger)).toBeNull();
  });
});
