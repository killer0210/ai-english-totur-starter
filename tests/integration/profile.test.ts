import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { POST as onboardingRoute } from "@/app/api/onboarding/route";
import { PATCH as profileRoute } from "@/app/api/profile/route";

import {
  adminClient,
  anonClient,
  createUser,
  deleteUser,
  jsonRequest,
  sessionCookie,
  signedInClient,
} from "./support/supabase";

type User = Awaited<ReturnType<typeof createUser>> & { cookie: string };

const created: string[] = [];
const COMPLETED_AT = "2026-01-01T00:00:00+00:00";

async function newUser(label: string): Promise<User> {
  const user = await createUser(label);
  created.push(user.id);
  return { ...user, cookie: await sessionCookie(user.email, user.password) };
}

async function setProfile(id: string, values: Record<string, unknown>) {
  const { error } = await adminClient().from("profiles").update(values).eq("id", id);
  if (error) throw error;
}

async function readProfile(id: string) {
  const { data, error } = await adminClient()
    .from("profiles")
    .select(
      "english_level, goals, daily_minutes_goal, baseline_confidence, display_name, age_confirmed_at, onboarding_completed_at",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

function patchProfile(body: unknown, cookie?: string, headers: Record<string, string> = {}) {
  return profileRoute(
    jsonRequest("/api/profile", body, { ...(cookie ? { cookie } : {}), ...headers }, "PATCH"),
  );
}

function postOnboarding(body: unknown, cookie?: string) {
  return onboardingRoute(jsonRequest("/api/onboarding", body, cookie ? { cookie } : {}));
}

afterAll(async () => {
  await Promise.all(created.map(deleteUser));
});

describe("POST /api/onboarding", () => {
  let user: User;

  beforeAll(async () => {
    user = await newUser("onb");
  });

  beforeEach(async () => {
    await setProfile(user.id, {
      age_confirmed_at: new Date().toISOString(),
      onboarding_completed_at: null,
      english_level: "A2",
      goals: [],
      daily_minutes_goal: 10,
      baseline_confidence: null,
    });
  });

  it("returns 401 without a session", async () => {
    const response = await postOnboarding({});
    expect(response.status).toBe(401);
  });

  it("is forbidden before the 18+ confirmation", async () => {
    await setProfile(user.id, { age_confirmed_at: null });
    const response = await postOnboarding({}, user.cookie);
    expect(response.status).toBe(403);
    expect((await readProfile(user.id)).onboarding_completed_at).toBeNull();
  });

  it("saves the defaults and sets onboarding_completed_at to server time", async () => {
    const before = Date.now();
    const response = await postOnboarding({}, user.cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectTo: "/home" });

    const profile = await readProfile(user.id);
    expect(profile).toMatchObject({
      english_level: "A2",
      goals: [],
      daily_minutes_goal: 10,
      baseline_confidence: 3,
    });
    const completedAt = Date.parse(profile.onboarding_completed_at as string);
    expect(completedAt).toBeGreaterThanOrEqual(before - 5_000);
    expect(completedAt).toBeLessThanOrEqual(Date.now() + 5_000);
  });

  it("saves chosen answers", async () => {
    const response = await postOnboarding(
      { goals: ["work", "daily"], dailyMinutesGoal: 5, englishLevel: "B1", baselineConfidence: 2 },
      user.cookie,
    );
    expect(response.status).toBe(200);
    expect(await readProfile(user.id)).toMatchObject({
      english_level: "B1",
      goals: ["work", "daily"],
      daily_minutes_goal: 5,
      baseline_confidence: 2,
    });
  });

  it("rejects a client-supplied onboarding_completed_at (cannot be forged)", async () => {
    for (const body of [
      { onboardingCompletedAt: COMPLETED_AT },
      { onboarding_completed_at: COMPLETED_AT },
    ]) {
      const response = await postOnboarding(body, user.cookie);
      expect(response.status).toBe(400);
    }
    expect((await readProfile(user.id)).onboarding_completed_at).toBeNull();
  });

  it("is idempotent: a repeat call changes neither the answers nor the timestamp", async () => {
    await setProfile(user.id, { onboarding_completed_at: COMPLETED_AT, english_level: "B1" });
    const response = await postOnboarding({ englishLevel: "A1" }, user.cookie);
    expect(response.status).toBe(200);
    const profile = await readProfile(user.id);
    expect(Date.parse(profile.onboarding_completed_at as string)).toBe(Date.parse(COMPLETED_AT));
    expect(profile.english_level).toBe("B1");
  });
});

describe("PATCH /api/profile", () => {
  let a: User;
  let b: User;

  beforeAll(async () => {
    a = await newUser("pa");
    b = await newUser("pb");
  });

  beforeEach(async () => {
    const base = {
      age_confirmed_at: new Date().toISOString(),
      onboarding_completed_at: COMPLETED_AT,
      english_level: "A2",
      goals: ["daily"],
      daily_minutes_goal: 10,
      baseline_confidence: 3,
      display_name: null,
    };
    await setProfile(a.id, base);
    await setProfile(b.id, base);
  });

  it("returns 401 without a session", async () => {
    const response = await patchProfile({ englishLevel: "B1" });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a foreign Origin (CSRF)", async () => {
    const response = await patchProfile({ englishLevel: "B1" }, a.cookie, {
      origin: "https://evil.example",
    });
    expect(response.status).toBe(403);
    expect((await readProfile(a.id)).english_level).toBe("A2");
  });

  it("updates the four allowed fields and returns the saved values", async () => {
    const response = await patchProfile(
      {
        englishLevel: "B1",
        goals: ["work", "school"],
        dailyMinutesGoal: 20,
        baselineConfidence: 5,
      },
      a.cookie,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profile: {
        englishLevel: "B1",
        goals: ["work", "school"],
        dailyMinutesGoal: 20,
        baselineConfidence: 5,
      },
    });
    expect(await readProfile(a.id)).toMatchObject({
      english_level: "B1",
      goals: ["work", "school"],
      daily_minutes_goal: 20,
      baseline_confidence: 5,
      onboarding_completed_at: expect.any(String),
    });
  });

  it("changes only the fields sent", async () => {
    const response = await patchProfile({ dailyMinutesGoal: 5 }, a.cookie);
    expect(response.status).toBe(200);
    expect(await readProfile(a.id)).toMatchObject({
      english_level: "A2",
      goals: ["daily"],
      daily_minutes_goal: 5,
      baseline_confidence: 3,
    });
  });

  it.each([
    ["display_name", { englishLevel: "B1", display_name: "x" }],
    ["displayName", { englishLevel: "B1", displayName: "x" }],
    ["age_confirmed_at", { englishLevel: "B1", age_confirmed_at: null }],
    ["an invalid value", { englishLevel: "B2" }],
    ["an empty body", {}],
  ])("rejects %s with 400 and changes nothing", async (_label, body) => {
    const before = await readProfile(a.id);
    const response = await patchProfile(body, a.cookie);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_FAILED");
    expect(await readProfile(a.id)).toEqual(before);
  });

  it("cannot clear or move onboarding_completed_at", async () => {
    for (const body of [
      { onboardingCompletedAt: null },
      { onboarding_completed_at: null },
      { englishLevel: "B1", onboardingCompletedAt: "2030-01-01T00:00:00Z" },
    ]) {
      const response = await patchProfile(body, a.cookie);
      expect(response.status).toBe(400);
    }
    const profile = await readProfile(a.id);
    expect(Date.parse(profile.onboarding_completed_at as string)).toBe(Date.parse(COMPLETED_AT));
    expect(profile.english_level).toBe("A2");
  });

  it("user A cannot change user B's profile", async () => {
    // The target comes only from the session; a user id in the body is rejected.
    for (const body of [
      { id: b.id, englishLevel: "B1" },
      { userId: b.id, englishLevel: "B1" },
      { user_id: b.id, englishLevel: "B1" },
    ]) {
      expect((await patchProfile(body, a.cookie)).status).toBe(400);
    }
    const response = await patchProfile({ englishLevel: "A1" }, a.cookie);
    expect(response.status).toBe(200);

    expect((await readProfile(a.id)).english_level).toBe("A1");
    expect((await readProfile(b.id)).english_level).toBe("A2");
  });

  it("is forbidden before onboarding is completed", async () => {
    await setProfile(a.id, { onboarding_completed_at: null });
    const response = await patchProfile({ englishLevel: "B1" }, a.cookie);
    expect(response.status).toBe(403);
    expect(await readProfile(a.id)).toMatchObject({
      english_level: "A2",
      onboarding_completed_at: null,
    });
  });
});

describe("profiles stay read-only for client roles", () => {
  let user: Awaited<ReturnType<typeof createUser>>;

  beforeAll(async () => {
    user = await createUser("direct");
    created.push(user.id);
    await setProfile(user.id, { onboarding_completed_at: COMPLETED_AT });
  });

  it("a signed-in browser client cannot UPDATE settings or onboarding_completed_at directly", async () => {
    const client = await signedInClient(user.email, user.password);
    for (const values of [
      { english_level: "B1" },
      { baseline_confidence: 1 },
      { onboarding_completed_at: null },
    ]) {
      const { data, error } = await client
        .from("profiles")
        .update(values)
        .eq("id", user.id)
        .select("id");
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    }
    const signedOut = await anonClient()
      .from("profiles")
      .update({ english_level: "B1" })
      .eq("id", user.id)
      .select("id");
    expect(signedOut.error !== null || (signedOut.data ?? []).length === 0).toBe(true);

    const profile = await readProfile(user.id);
    expect(profile.english_level).toBe("A2");
    expect(profile.baseline_confidence).toBeNull();
    expect(Date.parse(profile.onboarding_completed_at as string)).toBe(Date.parse(COMPLETED_AT));
  });
});
