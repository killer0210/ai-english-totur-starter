import { describe, expect, it } from "vitest";

import {
  onboardingSchema,
  PROFILE_DEFAULTS,
  profileUpdateSchema,
} from "@/features/profile/schemas";

const full = {
  goals: ["work", "travel"],
  dailyMinutesGoal: 20,
  englishLevel: "B1",
  baselineConfidence: 4,
};

describe("onboardingSchema", () => {
  it("accepts a full set of answers", () => {
    expect(onboardingSchema.parse(full)).toEqual(full);
  });

  it("fills every missing answer with the default (A2, 10 min, no goals, confidence 3)", () => {
    expect(onboardingSchema.parse({})).toEqual(PROFILE_DEFAULTS);
    expect(PROFILE_DEFAULTS).toEqual({
      goals: [],
      dailyMinutesGoal: 10,
      englishLevel: "A2",
      baselineConfidence: 3,
    });
  });

  it.each([5, 10, 20])("allows %i daily minutes", (minutes) => {
    expect(onboardingSchema.safeParse({ dailyMinutesGoal: minutes }).success).toBe(true);
  });

  it.each([0, 15, 30, "10"])("rejects %s daily minutes", (minutes) => {
    expect(onboardingSchema.safeParse({ dailyMinutesGoal: minutes }).success).toBe(false);
  });

  it.each(["A1", "A2", "B1"])("allows level %s", (level) => {
    expect(onboardingSchema.safeParse({ englishLevel: level }).success).toBe(true);
  });

  it.each(["B2", "a1", ""])("rejects level %s (no B2 in the MVP)", (level) => {
    expect(onboardingSchema.safeParse({ englishLevel: level }).success).toBe(false);
  });

  it.each([1, 2, 3, 4, 5])("allows confidence %i", (value) => {
    expect(onboardingSchema.safeParse({ baselineConfidence: value }).success).toBe(true);
  });

  it.each([0, 6, 2.5, "3"])("rejects confidence %s", (value) => {
    expect(onboardingSchema.safeParse({ baselineConfidence: value }).success).toBe(false);
  });

  it("allows only the listed goals, without duplicates", () => {
    expect(
      onboardingSchema.safeParse({ goals: ["work", "school", "travel", "daily"] }).success,
    ).toBe(true);
    expect(onboardingSchema.safeParse({ goals: ["exam"] }).success).toBe(false);
    expect(onboardingSchema.safeParse({ goals: ["work", "work"] }).success).toBe(false);
    expect(onboardingSchema.safeParse({ goals: "work" }).success).toBe(false);
  });

  it.each([
    ["onboardingCompletedAt", "2020-01-01T00:00:00Z"],
    ["onboarding_completed_at", null],
    ["ageConfirmedAt", "2020-01-01T00:00:00Z"],
    ["userId", "00000000-0000-0000-0000-000000000000"],
    ["id", "00000000-0000-0000-0000-000000000000"],
    ["displayName", "x"],
  ])("rejects the unknown field %s", (key, value) => {
    expect(onboardingSchema.safeParse({ ...full, [key]: value }).success).toBe(false);
  });
});

describe("profileUpdateSchema", () => {
  it("accepts any subset of the four fields", () => {
    expect(profileUpdateSchema.parse({ englishLevel: "A1" })).toEqual({ englishLevel: "A1" });
    expect(profileUpdateSchema.parse({ goals: [] })).toEqual({ goals: [] });
    expect(profileUpdateSchema.parse(full)).toEqual(full);
  });

  it("does not fill defaults (a partial update leaves other fields alone)", () => {
    expect(profileUpdateSchema.parse({ baselineConfidence: 5 })).toEqual({
      baselineConfidence: 5,
    });
  });

  it("rejects an empty update", () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("rejects invalid values", () => {
    expect(profileUpdateSchema.safeParse({ englishLevel: "B2" }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ dailyMinutesGoal: 15 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ baselineConfidence: 0 }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ goals: ["exam"] }).success).toBe(false);
  });

  it.each([
    ["onboardingCompletedAt", null],
    ["onboarding_completed_at", "2020-01-01T00:00:00Z"],
    ["ageConfirmedAt", null],
    ["id", "00000000-0000-0000-0000-000000000000"],
    ["displayName", "x"],
  ])("rejects the unknown field %s", (key, value) => {
    expect(profileUpdateSchema.safeParse({ englishLevel: "A1", [key]: value }).success).toBe(false);
  });
});
